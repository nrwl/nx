import type { Tree } from 'nx/src/devkit-exports';
import { lt } from 'semver';
import { isNonSemverDistTag, normalizeSemver } from './installed-version';
import { getDependencyVersionFromPackageJson } from './package-json';

/**
 * Throws a standardized error when a package is installed at a version below
 * a plugin's supported floor.
 *
 * Use this at every site where a plugin determines the installed version of
 * a supported package is below its declared floor, so the message is
 * consistent across plugins.
 *
 * @param packageName Name of the package (e.g. `@angular/core`).
 * @param installedVersion Version detected in the workspace (e.g. `18.2.0`).
 * @param floor Lowest version the plugin supports (e.g. `19.0.0`).
 */
export function throwForUnsupportedVersion(
  packageName: string,
  installedVersion: string,
  floor: string
): never {
  throw new Error(
    `Unsupported version of \`${packageName}\` detected.\n\n` +
      `  Installed: ${installedVersion}\n` +
      `  Supported: >= ${floor}\n\n` +
      `Update \`${packageName}\` to ${floor} or higher.`
  );
}

/**
 * Asserts that a package detected in the workspace is at or above the
 * plugin's supported floor. No-op when the package is not detected
 * (fresh-install path) or when declared as `latest`/`next`. Throws via
 * `throwForUnsupportedVersion` (with the original declared range for
 * clarity) when below floor.
 *
 * Use from generator entry points to fail fast on unsupported workspaces
 * before writing any incompatible config.
 */
export function assertSupportedPackageVersion(
  tree: Tree,
  packageName: string,
  minSupportedVersion: string
): void {
  const declared = getDependencyVersionFromPackageJson(tree, packageName);
  if (!declared || isNonSemverDistTag(declared)) {
    return;
  }
  const cleaned = normalizeSemver(declared);
  if (cleaned && lt(cleaned, minSupportedVersion)) {
    throwForUnsupportedVersion(packageName, declared, minSupportedVersion);
  }
}
