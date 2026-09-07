import { readModulePackageJson } from 'nx/src/devkit-internals';
import { readJson, type Tree } from 'nx/src/devkit-exports';
import { clean, coerce } from 'semver';
import { getDependencyVersionFromPackageJson } from './package-json';

/**
 * Returns the concrete version of a package as resolved by Node module
 * resolution from the workspace. Reads the installed package's own
 * `package.json` — not the workspace's declared range.
 *
 * Use this from executor / runtime contexts where node_modules is present.
 * Generator-time code should read from the tree first (the declared range or
 * `getInstalledPackageVersionFromTree`) and may fall back to this with
 * `requirePaths` restricted to the workspace root.
 *
 * Pass `requirePaths` to resolve from specific directories only (e.g. the
 * workspace root, excluding the `.nx/installation` fallback); otherwise the
 * default nx require paths are used.
 *
 * Returns `null` when the package is not resolvable.
 */
export function getInstalledPackageVersion(
  packageName: string,
  requirePaths?: string[]
): string | null {
  try {
    const { packageJson } = requirePaths
      ? readModulePackageJson(packageName, requirePaths)
      : readModulePackageJson(packageName);
    return typeof packageJson.version === 'string' ? packageJson.version : null;
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

/**
 * Reads the installed version of a package from the tree's `node_modules`,
 * so it reflects in-flight tree changes and stays controllable in tests.
 * Returns `null` when the package is not present in the tree's
 * `node_modules`.
 */
export function getInstalledPackageVersionFromTree(
  tree: Tree,
  packageName: string
): string | null {
  try {
    const { version } = readJson(
      tree,
      `node_modules/${packageName}/package.json`
    );
    return typeof version === 'string' ? version : null;
  } catch {
    return null;
  }
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
