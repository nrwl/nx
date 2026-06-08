import { getDependencyVersionFromPackageJson, type Tree } from '@nx/devkit';
import { coerce, gte, minVersion } from 'semver';
import { typescriptVersion } from './versions';

/**
 * Checks whether the workspace's declared `typescript` dependency is at or
 * above the given version. The minimum version of the declared range is
 * compared (e.g. `^5.9.2` -> `5.9.2`, `<6` -> `0.0.0`, `*` -> `0.0.0`).
 * When `typescript` is not declared, the version Nx installs by default is
 * assumed. Dist-tags and unparseable ranges (e.g. `latest`, `next`) have no
 * resolvable floor version, so they are treated as meeting any version.
 *
 * Use from generators to emit version-appropriate config when a single value
 * is not valid across the supported TypeScript range.
 */
export function isTypescriptVersionAtLeast(
  tree: Tree,
  version: string
): boolean {
  const declared =
    getDependencyVersionFromPackageJson(tree, 'typescript') ??
    typescriptVersion;
  const minimum = getRangeMinimum(declared);
  return !minimum || gte(minimum, version);
}

/**
 * Returns the minimum satisfying version for a semver range, stripping
 * prerelease so `>=6.0.0-beta.1` still counts as 6.0. Falls back to coerce()
 * for dist-tags and garbage inputs that minVersion() cannot parse.
 */
export function getRangeMinimum(range: string): string | undefined {
  try {
    const min = minVersion(range);
    if (min) {
      return `${min.major}.${min.minor}.${min.patch}`;
    }
  } catch {
    // fall through to coerce for dist-tags and other unparseable inputs
  }
  return coerce(range)?.version;
}
