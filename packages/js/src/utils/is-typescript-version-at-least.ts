import { getDependencyVersionFromPackageJson, type Tree } from '@nx/devkit';
import { coerce, gte } from 'semver';
import { typescriptVersion } from './versions';

/**
 * Checks whether the workspace's declared `typescript` dependency is at or
 * above the given version. The minimum version of the declared range is
 * compared (e.g. `^5.9.2` -> `5.9.2`). When `typescript` is not declared,
 * the version Nx installs by default is assumed. Dist-tags and unparseable
 * ranges (e.g. `latest`, `next`) resolve to the newest TypeScript, so they
 * are treated as meeting any version.
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
  const minimum = coerce(declared)?.version;
  return !minimum || gte(minimum, version);
}
