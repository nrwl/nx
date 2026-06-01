import { type Tree } from '@nx/devkit';
import {
  getDeclaredPackageVersion,
  getInstalledPackageVersion,
} from '@nx/devkit/internal';
import { major } from 'semver';

export const nxVersion = require('../../package.json').version;

export const minSupportedExpressVersion = '4.0.0';

// Fresh-install constants (latest supported major).
export const expressVersion = '^5.1.0';
export const expressTypingsVersion = '^5.0.0';

type ExpressVersions = {
  expressVersion: string;
  expressTypingsVersion: string;
};

const latestVersions: ExpressVersions = {
  expressVersion,
  expressTypingsVersion,
};

type CompatVersions = 4;
const versionMap: Record<CompatVersions, ExpressVersions> = {
  4: {
    expressVersion: '^4.21.2',
    expressTypingsVersion: '^4.17.21',
  },
};

export function versions(tree: Tree): ExpressVersions {
  const installedExpressVersion = getInstalledExpressVersion(tree);
  if (!installedExpressVersion) {
    return latestVersions;
  }
  const expressMajorVersion = major(installedExpressVersion);
  return versionMap[expressMajorVersion as CompatVersions] ?? latestVersions;
}

export function getInstalledExpressVersion(tree?: Tree): string | null {
  if (!tree) {
    return getInstalledPackageVersion('express');
  }
  return getDeclaredPackageVersion(tree, 'express');
}
