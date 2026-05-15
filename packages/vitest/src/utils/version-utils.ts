import { getDependencyVersionFromPackageJson } from '@nx/devkit';
import type { Tree } from 'nx/src/generators/tree';
import { clean, coerce, major } from 'semver';
import { vitestVersion } from './versions';

export function getInstalledViteVersion(tree: Tree): string {
  const installedViteVersion = getDependencyVersionFromPackageJson(
    tree,
    'vite'
  );

  if (
    !installedViteVersion ||
    installedViteVersion === 'latest' ||
    installedViteVersion === 'beta'
  ) {
    return clean(vitestVersion) ?? coerce(vitestVersion).version;
  }

  return clean(installedViteVersion) ?? coerce(installedViteVersion).version;
}

export function getInstalledViteMajorVersion(
  tree: Tree
): 5 | 6 | 7 | 8 | undefined {
  const installedViteVersion = getInstalledViteVersion(tree);
  if (!installedViteVersion) {
    return;
  }

  const installedMajor = major(installedViteVersion);
  if (installedMajor < 5 || installedMajor > 8) {
    return undefined;
  }
  return installedMajor as 5 | 6 | 7 | 8;
}
