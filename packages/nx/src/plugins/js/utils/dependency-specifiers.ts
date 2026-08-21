import { satisfies } from 'semver';
import type {
  PackageDependencyCollection,
  ProjectPackageDependencies,
} from '../../../config/workspace-json-project-json';
import type { PackageJson } from '../../../utils/package-json';

/**
 * The parsed form of a package.json dependency version specifier.
 *
 * `requestedPackageName` is only set for aliasing specifiers
 * (`workspace:<name>@<range>`, `npm:<name>[@<range>]`) where the requested
 * package differs from the manifest key. `range` is the version range portion
 * of the specifier, when one exists.
 */
export interface ParsedDependencySpecifier {
  protocol: 'plain' | 'workspace' | 'npm' | 'file' | 'other';
  requestedPackageName: string | null;
  range: string | null;
}

// matches protocol-like prefixes (catalog:, link:, portal:, patch:, git:,
// github:, http(s):, etc.); plain semver ranges never contain a colon
const PROTOCOL_REGEX = /^[a-z][a-z0-9+.-]*:/i;

/**
 * Parses a package.json dependency version specifier into its protocol,
 * embedded package name (for aliasing specifiers), and version range.
 *
 * Supported aliasing forms:
 * - `workspace:<name>@<range>` (pnpm; the name may be scoped)
 * - `npm:<name>` and `npm:<name>@<range>` (npm, pnpm, yarn, bun)
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
    // workspace:*, workspace:^, workspace:~, workspace:<range>. A bare
    // unscoped name (workspace:foo) is indistinguishable from a tag range, so
    // it is treated as a range, matching the package managers' own parsing.
    return { protocol: 'workspace', requestedPackageName: null, range: rest };
  }

  if (rawSpecifier.startsWith('npm:')) {
    const rest = rawSpecifier.slice('npm:'.length);
    const { name, range } = splitNameAndRange(rest);
    if (name !== null) {
      return { protocol: 'npm', requestedPackageName: name, range };
    }
    // npm:<name> without a range always names a package
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

/**
 * Splits `<name>@<range>` into its parts, handling scoped names
 * (`@scope/pkg@^1`). Returns a null name when the input has no `<name>@`
 * prefix, and a null range for a scoped name without a range (`@scope/pkg`).
 */
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
 * Applies the policy for matching a package.json dependency entry to a
 * workspace package:
 * - a target-bearing `workspace:` alias matches the requested package whenever
 *   it exists, regardless of range satisfaction (the protocol is an explicit
 *   local-selection instruction); the alias requires the `@<range>` separator
 *   (`workspace:@scope/pkg` without it is rejected by package managers);
 * - a bare `workspace:` specifier matches the dependency key whenever it
 *   exists;
 * - an `npm:` alias matches the requested package only when the workspace
 *   package's version satisfies the requested range;
 * - a plain range matches the dependency key when it is `*` or the workspace
 *   package's version satisfies it;
 * - `file:` and other protocols never match here (`file:` needs path
 *   resolution, which callers handle with their own context).
 *
 * `getPackageVersion` returns the workspace package's version, `null` when the
 * package exists without a version, or `undefined` when no workspace package
 * has that name.
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
        // workspace:@scope/pkg without the @<range> separator; pnpm rejects
        // the form (an empty range, workspace:@scope/pkg@, is valid)
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
 * Collects the manifest's dependency entries that resolve to workspace
 * packages by package name and range, keyed by collection and manifest key.
 * `file:` entries are never included; they resolve by path, which consumers
 * handle with their own context. Returns undefined when no entry resolves, so
 * payload-sensitive consumers can omit the field entirely.
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
