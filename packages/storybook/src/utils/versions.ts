import { getDependencyVersionFromPackageJson, type Tree } from '@nx/devkit';
import { coerce, major } from 'semver';
import { join } from 'path';

export const nxVersion = require(join('@nx/storybook', 'package.json')).version;
export const litVersion = '^2.6.1';
export const tsNodeVersion = '10.9.1';
export const tsLibVersion = '^2.3.0';

export const minSupportedStorybookVersion = '8.0.0';

// Fresh-install default. Latest supported major.
export const storybookVersion = '^10.5.0';
export const reactVersion = '^18.2.0';
export const viteVersion = '^6.0.0';

export const coreJsVersion = '^3.36.1';

type StorybookVersions = {
  storybookVersion: string;
};

const latestVersions: StorybookVersions = {
  storybookVersion,
};

type CompatVersions = 8 | 9 | 10;
const versionMap: Record<CompatVersions, StorybookVersions> = {
  8: { storybookVersion: '^8.6.11' },
  9: { storybookVersion: '^9.0.5' },
  10: { storybookVersion: '^10.5.0' },
};

export function versions(tree: Tree): StorybookVersions {
  const installedStorybookMajor = storybookMajorVersion(tree);
  if (installedStorybookMajor === undefined) {
    return latestVersions;
  }
  return (
    versionMap[installedStorybookMajor as CompatVersions] ?? latestVersions
  );
}

export function storybookMajorVersion(tree?: Tree): number | undefined {
  const installedVersion = getInstalledStorybookVersion(tree);
  if (!installedVersion) {
    return undefined;
  }
  const coerced = coerce(installedVersion);
  return coerced ? major(coerced) : undefined;
}

export function getInstalledStorybookVersion(tree?: Tree): string | undefined {
  if (tree) {
    const declared = getDependencyVersionFromPackageJson(tree, 'storybook');
    if (declared) {
      return declared;
    }
  }

  // Fall back to resolving from disk when no tree declaration is available.
  try {
    return require(join('storybook', 'package.json')).version;
  } catch {
    return undefined;
  }
}
