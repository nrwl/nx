import { readModulePackageJson } from 'nx/src/devkit-internals';
import type { Tree } from 'nx/src/devkit-exports';
import { clean, coerce } from 'semver';
import { getDependencyVersionFromPackageJson } from './package-json';

/**
 * Returns the concrete version of a package as resolved by Node module
 * resolution from the workspace. Reads the installed package's own
 * `package.json` — not the workspace's declared range.
 *
 * Use this from executor / runtime contexts where node_modules is present.
 * Generator-time code should use `getDeclaredPackageVersion` instead.
 *
 * Returns `null` when the package is not resolvable.
 */
export function getInstalledPackageVersion(packageName: string): string | null {
  try {
    const { packageJson } = readModulePackageJson(packageName);
    return packageJson.version ?? null;
  } catch {
    return null;
  }
}

/**
 * Returns the declared version of a package as read from the workspace's
 * `package.json`, normalized to a plain semver string (range markers
 * stripped) suitable for arithmetic comparisons (e.g. `lt(v, '1.37.0')`).
 *
 * When the package is missing or declared as `latest`/`next`, falls back to
 * the cleaned `latestKnownVersion` if provided; otherwise returns `null`.
 *
 * Use this from generator-time contexts where node_modules is not assumed
 * to be present. Executor / runtime code should use
 * `getInstalledPackageVersion` instead.
 */
export function getDeclaredPackageVersion(
  tree: Tree,
  packageName: string,
  latestKnownVersion?: string
): string | null {
  const declared = getDependencyVersionFromPackageJson(tree, packageName);
  if (declared && !isNonSemverDistTag(declared)) {
    const normalized = normalizeSemver(declared);
    if (normalized) return normalized;
  }
  return latestKnownVersion ? normalizeSemver(latestKnownVersion) : null;
}

export const NON_SEMVER_DIST_TAGS = ['latest', 'next'] as const;
export type NonSemverDistTag = (typeof NON_SEMVER_DIST_TAGS)[number];

export function isNonSemverDistTag(
  version: string
): version is NonSemverDistTag {
  return (NON_SEMVER_DIST_TAGS as readonly string[]).includes(version);
}

export function normalizeSemver(version: string): string | null {
  return clean(version) ?? coerce(version)?.version ?? null;
}
