import { type Tree } from '@nx/devkit';
import {
  getDeclaredPackageVersion,
  getInstalledPackageVersion,
} from '@nx/devkit/internal';
import { major } from 'semver';
import { join } from 'path';

export const nxVersion = require(join('@nx/nest', 'package.json')).version;

export const tsLibVersion = '^2.3.0';

// NestJS has no public LTS table; cadence is roughly one major per year.
// Support window: v10 + v11 (Rule 2 — N & N-1 — since v10.4.x still receives
// upstream patches).
export const minSupportedNestJsVersion = '10.0.0';

// Fresh-install constants — latest supported major.
export const nestJsVersion = '^11.0.0';
export const nestJsSchematicsVersion = '^11.0.0';
export const rxjsVersion = '^7.8.0';
export const reflectMetadataVersion = '^0.2.0';

type NestJsVersions = {
  nestJsVersion: string;
  nestJsSchematicsVersion: string;
  rxjsVersion: string;
  reflectMetadataVersion: string;
};

const latestVersions: NestJsVersions = {
  nestJsVersion,
  nestJsSchematicsVersion,
  rxjsVersion,
  reflectMetadataVersion,
};

type CompatVersions = 10;
const versionMap: Record<CompatVersions, NestJsVersions> = {
  10: {
    nestJsVersion: '^10.0.2',
    nestJsSchematicsVersion: '^10.0.1',
    rxjsVersion: '^7.8.0',
    reflectMetadataVersion: '^0.1.13',
  },
};

export function versions(tree: Tree): NestJsVersions {
  const installed = getInstalledNestJsVersion(tree);
  if (!installed) {
    return latestVersions;
  }
  const nestMajor = major(installed);
  return versionMap[nestMajor as CompatVersions] ?? latestVersions;
}

export function getInstalledNestJsVersion(tree?: Tree): string | null {
  if (!tree) {
    return getInstalledPackageVersion('@nestjs/core');
  }
  return getDeclaredPackageVersion(tree, '@nestjs/core');
}
