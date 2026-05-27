import { type Tree } from '@nx/devkit';
import {
  getDeclaredPackageVersion,
  getInstalledPackageVersion,
} from '@nx/devkit/internal';
import { join } from 'path';
import { major } from 'semver';
import { useFlatConfig } from './flat-config';

export const nxVersion = require(join('@nx/eslint', 'package.json')).version;

export const minSupportedEslintVersion = '8.0.0';

export const eslintConfigPrettierVersion = '^10.0.0';
export const eslintrcVersion = '^2.1.1';
export const jsoncEslintParserVersion = '^2.1.0';
export const eslintCompat = '^1.1.1';

export const eslintVersion = '^9.8.0';
export const typescriptESLintVersion = '^8.40.0';

type EslintVersions = {
  eslintVersion: string;
  typescriptESLintVersion: string;
};

const latestVersions: EslintVersions = {
  eslintVersion,
  typescriptESLintVersion,
};

type CompatVersions = 8;
const versionMap: Record<CompatVersions, EslintVersions> = {
  8: {
    eslintVersion: '~8.57.0',
    typescriptESLintVersion: '^7.16.0',
  },
};

export function versions(tree: Tree): EslintVersions {
  const installedEslintVersion = getInstalledEslintVersion(tree);
  if (installedEslintVersion) {
    const eslintMajorVersion = major(installedEslintVersion);
    return versionMap[eslintMajorVersion as CompatVersions] ?? latestVersions;
  }
  // No ESLint declared yet — honor the user's flat-config preference for the
  // fresh-install lane. Legacy (eslintrc) workspaces need the v8/v7 lane
  // because `@typescript-eslint/rule-tester` v8+ dropped eslintrc support
  // entirely and v7 rule-tester is pinned to ESLint v8.
  return useFlatConfig(tree) ? latestVersions : versionMap[8];
}

export function getInstalledEslintVersion(tree?: Tree): string | null {
  if (!tree) {
    return getInstalledPackageVersion('eslint');
  }
  return getDeclaredPackageVersion(tree, 'eslint');
}

export function getInstalledEslintMajorVersion(tree?: Tree): number | null {
  const installedEslintVersion = getInstalledEslintVersion(tree);
  return installedEslintVersion ? major(installedEslintVersion) : null;
}
