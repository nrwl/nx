import { getDependencyVersionFromPackageJson, type Tree } from '@nx/devkit';
import { coerce, intersects, major } from 'semver';
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

export const testRunnerVersion = '^0.24.0';

type StorybookVersions = {
  storybookVersion: string;
  // Each test runner line supports a narrow window of storybook versions.
  testRunnerVersion: string;
};

const latestVersions: StorybookVersions = {
  storybookVersion,
  testRunnerVersion,
};

type CompatVersions = 8 | 9 | 10;
const versionMap: Record<CompatVersions, StorybookVersions> = {
  8: { storybookVersion: '^8.6.11', testRunnerVersion: '^0.21.0' },
  9: { storybookVersion: '^9.0.5', testRunnerVersion: '^0.23.0' },
  10: { storybookVersion: '^10.5.0', testRunnerVersion },
};

export function versions(tree: Tree): StorybookVersions {
  const installedStorybookMajor = storybookMajorVersion(tree);
  if (installedStorybookMajor === undefined) {
    return latestVersions;
  }
  const compat =
    versionMap[installedStorybookMajor as CompatVersions] ?? latestVersions;

  // 0.20 is the first runner line to declare a storybook peer, and it peers ^8.2.
  // Ranges that cannot reach 8.2 need 0.17, the earliest line built against 8.
  if (
    installedStorybookMajor === 8 &&
    !storybookVersionIntersects(tree, '>=8.2.0')
  ) {
    return { ...compat, testRunnerVersion: '^0.17.0' };
  }

  return compat;
}

function storybookVersionIntersects(tree: Tree, range: string): boolean {
  const installedVersion = getInstalledStorybookVersion(tree);
  if (!installedVersion) {
    return false;
  }

  try {
    return intersects(installedVersion, range);
  } catch {
    return false;
  }
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
