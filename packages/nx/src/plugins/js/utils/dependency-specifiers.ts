import { satisfies } from 'semver';
import type {
  PackageDependencyCollection,
  ProjectPackageDependencies,
} from '../../../config/workspace-json-project-json';
import type { PackageJson } from '../../../utils/package-json';

export interface ParsedDependencySpecifier {
  protocol: 'plain' | 'workspace' | 'npm' | 'file' | 'other';
  requestedPackageName: string | null;
  range: string | null;
}

// Match protocol prefixes; plain semver ranges contain no colon.
const PROTOCOL_REGEX = /^[a-z][a-z0-9+.-]*:/i;

/**
 * Parses plain, workspace, npm-alias, file, and other specifiers. Supports
 * scoped aliases and npm aliases without ranges; returns the embedded
 * package name and range when present.
 */
export function parseDependencySpecifier(
  rawSpecifier: string
): ParsedDependencySpecifier {
  if (rawSpecifier.startsWith('workspace:')) {
    const rest = rawSpecifier.slice('workspace:'.length);
    const { name, range } = splitNameAndRange(rest);
    if (name !== null) {
      return { protocol: 'workspace', requestedPackageName: name, range };
    }
    // A bare unscoped name is indistinguishable from a range, so
    // workspace:foo is not parsed as an alias.
    return { protocol: 'workspace', requestedPackageName: null, range: rest };
  }

  if (rawSpecifier.startsWith('npm:')) {
    const rest = rawSpecifier.slice('npm:'.length);
    const { name, range } = splitNameAndRange(rest);
    if (name !== null) {
      return { protocol: 'npm', requestedPackageName: name, range };
    }
    return { protocol: 'npm', requestedPackageName: rest, range: null };
  }

  if (rawSpecifier.startsWith('file:')) {
    return { protocol: 'file', requestedPackageName: null, range: null };
  }

  if (PROTOCOL_REGEX.test(rawSpecifier)) {
    return { protocol: 'other', requestedPackageName: null, range: null };
  }

  return { protocol: 'plain', requestedPackageName: null, range: rawSpecifier };
}

function splitNameAndRange(value: string): {
  name: string | null;
  range: string | null;
} {
  const atIndex = value.indexOf('@', value.startsWith('@') ? 1 : 0);
  if (atIndex > 0) {
    return { name: value.slice(0, atIndex), range: value.slice(atIndex + 1) };
  }
  if (value.startsWith('@')) {
    return { name: value, range: null };
  }
  return { name: null, range: null };
}

/**
 * Matches a dependency to a workspace package:
 * - a target-bearing `workspace:` alias requires the `@<range>` separator (an
 *   empty range is valid) and matches an existing target regardless of range;
 * - a bare `workspace:` specifier matches an existing package under the
 *   dependency key, also regardless of range;
 * - an `npm:` alias matches when rangeless, wildcard, or version-satisfying;
 * - a plain entry matches the dependency key when wildcard or
 *   version-satisfying;
 * - `file:` and other protocols do not match here.
 *
 * `getPackageVersion` returns the workspace package's version, `null` when the
 * package exists without a version, or `undefined` when no workspace package
 * has that name; wildcards match unversioned packages.
 */
export function matchDependencyToWorkspacePackage(
  dependencyKey: string,
  rawSpecifier: string,
  getPackageVersion: (packageName: string) => string | null | undefined
): { requestedPackageName: string } | null {
  const parsed = parseDependencySpecifier(rawSpecifier);

  switch (parsed.protocol) {
    case 'workspace': {
      if (parsed.requestedPackageName !== null && parsed.range === null) {
        return null;
      }
      const requestedPackageName = parsed.requestedPackageName ?? dependencyKey;
      return getPackageVersion(requestedPackageName) !== undefined
        ? { requestedPackageName }
        : null;
    }
    case 'npm': {
      const version = getPackageVersion(parsed.requestedPackageName);
      if (version === undefined) {
        return null;
      }
      if (
        parsed.range === null ||
        parsed.range === '*' ||
        (version !== null &&
          satisfies(version, parsed.range, { includePrerelease: true }))
      ) {
        return { requestedPackageName: parsed.requestedPackageName };
      }
      return null;
    }
    case 'plain': {
      const version = getPackageVersion(dependencyKey);
      if (version === undefined) {
        return null;
      }
      if (
        parsed.range === '*' ||
        (version !== null &&
          satisfies(version, parsed.range, { includePrerelease: true }))
      ) {
        return { requestedPackageName: dependencyKey };
      }
      return null;
    }
    case 'file':
    case 'other':
      return null;
  }
}

const DEPENDENCY_COLLECTIONS: PackageDependencyCollection[] = [
  'dependencies',
  'devDependencies',
  'optionalDependencies',
  'peerDependencies',
];

/**
 * Collects non-self manifest entries resolving to workspace packages,
 * grouped by dependency collection and key. Omits file: entries and
 * returns undefined when empty.
 */
export function getWorkspacePackageDependencies(
  packageJson: PackageJson,
  getPackageVersion: (packageName: string) => string | null | undefined
): ProjectPackageDependencies | undefined {
  let result: ProjectPackageDependencies | undefined;
  for (const collection of DEPENDENCY_COLLECTIONS) {
    const dependencies = packageJson[collection];
    if (!dependencies) {
      continue;
    }
    for (const [key, rawSpecifier] of Object.entries(dependencies)) {
      if (typeof rawSpecifier !== 'string') {
        continue;
      }
      const match = matchDependencyToWorkspacePackage(
        key,
        rawSpecifier,
        getPackageVersion
      );
      if (!match || match.requestedPackageName === packageJson.name) {
        continue;
      }
      result ??= {};
      result[collection] ??= {};
      result[collection][key] = {
        rawSpecifier,
        requestedPackageName: match.requestedPackageName,
      };
    }
  }
  return result;
}
