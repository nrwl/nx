import type { PackageJson } from '../../utils/package-json';
import { parseDependencySpecifier } from '../js/utils/dependency-specifiers';

const DEPENDENCY_COLLECTIONS = [
  'dependencies',
  'devDependencies',
  'optionalDependencies',
  'peerDependencies',
] as const;

/**
 * Collects diagnostics for target-bearing `workspace:<name>@<range>` aliases
 * whose requested package is not a package-manager workspace package. Package
 * managers reject these at install time; failing during graph construction
 * surfaces the broken manifest earlier and with a repair hint.
 *
 * `workspacePackageNames` must contain only packages the package manager
 * treats as part of the install (the root package and packages matched by the
 * workspace globs), so that out-of-workspaces fixtures never satisfy a name.
 */
export function findInvalidWorkspaceAliases(
  packageJson: PackageJson,
  workspacePackageNames: Set<string>
): string[] {
  const issues: string[] = [];
  for (const collection of DEPENDENCY_COLLECTIONS) {
    const dependencies = packageJson[collection];
    if (!dependencies) {
      continue;
    }
    for (const [key, rawSpecifier] of Object.entries(dependencies)) {
      if (typeof rawSpecifier !== 'string') {
        continue;
      }
      const parsed = parseDependencySpecifier(rawSpecifier);
      if (
        parsed.protocol !== 'workspace' ||
        parsed.requestedPackageName === null ||
        parsed.range === null ||
        workspacePackageNames.has(parsed.requestedPackageName)
      ) {
        continue;
      }
      issues.push(
        buildInvalidWorkspaceAliasMessage(
          key,
          rawSpecifier,
          parsed.requestedPackageName,
          workspacePackageNames
        )
      );
    }
  }
  return issues;
}

function buildInvalidWorkspaceAliasMessage(
  dependencyKey: string,
  rawSpecifier: string,
  requestedPackageName: string,
  workspacePackageNames: Set<string>
): string {
  const lines = [
    `Invalid workspace dependency alias "${dependencyKey}": "${rawSpecifier}".`,
    `The requested package "${requestedPackageName}" was not found among this repository's package-manager workspaces.`,
  ];
  const suggestions = findClosePackageNames(
    requestedPackageName,
    workspacePackageNames
  );
  if (suggestions.length === 1) {
    lines.push(`Did you mean "${suggestions[0]}"?`);
  } else if (suggestions.length > 1) {
    const quoted = suggestions.map((s) => `"${s}"`);
    lines.push(
      `Did you mean one of ${quoted.slice(0, -1).join(', ')}, or ${quoted.at(
        -1
      )}?`
    );
  }
  // the registry hint replaces workspace: with npm: rather than removing it:
  // removal would turn the entry into a request for the alias key and lose
  // the author's intended target
  lines.push(
    `Fix the package name or add "${requestedPackageName}" to the package-manager workspace configuration. If "${dependencyKey}" should resolve from the registry instead, replace "${rawSpecifier}" with "${rawSpecifier.replace(
      /^workspace:/,
      'npm:'
    )}".`
  );
  return lines.join('\n');
}

/**
 * Returns up to three workspace package names close to the given name, sorted
 * by edit distance, same-scope preference, then lexically. Only names within
 * a conservative distance threshold are returned, so a large monorepo does
 * not get flooded with unrelated candidates.
 */
export function findClosePackageNames(
  name: string,
  candidates: Set<string>
): string[] {
  const threshold = Math.max(2, Math.floor(name.length * 0.2));
  const scope = name.startsWith('@') ? name.split('/')[0] : null;
  const close: Array<{
    candidate: string;
    distance: number;
    sameScope: boolean;
  }> = [];
  for (const candidate of candidates) {
    const distance = levenshtein(name, candidate, threshold);
    if (distance > threshold) {
      continue;
    }
    close.push({
      candidate,
      distance,
      sameScope: scope !== null && candidate.startsWith(`${scope}/`),
    });
  }
  return close
    .sort(
      (a, b) =>
        a.distance - b.distance ||
        Number(b.sameScope) - Number(a.sameScope) ||
        (a.candidate < b.candidate ? -1 : 1)
    )
    .slice(0, 3)
    .map((c) => c.candidate);
}

function levenshtein(a: string, b: string, threshold: number): number {
  if (Math.abs(a.length - b.length) > threshold) {
    return threshold + 1;
  }
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      current[j] = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
    previous = current;
  }
  return previous[b.length];
}
