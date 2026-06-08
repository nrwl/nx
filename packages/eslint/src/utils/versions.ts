import { type Tree } from '@nx/devkit';
import {
  getDeclaredPackageVersion,
  getInstalledPackageVersion,
} from '@nx/devkit/internal';
import { join } from 'path';
import { major } from 'semver';

export const nxVersion = require(join('@nx/eslint', 'package.json')).version;

export const minSupportedEslintVersion = '8.0.0';

export const eslintConfigPrettierVersion = '^10.0.0';
export const eslintrcVersion = '^2.1.1';
export const jsoncEslintParserVersion = '^2.1.0';
export const eslintCompat = '^1.1.1';

export const eslintVersion = '^9.8.0';
export const typescriptESLintVersion = '^8.58.0';

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
    typescriptESLintVersion: '^8.40.0',
  },
};

export function versions(tree: Tree): EslintVersions {
  const installedEslintVersion = getInstalledEslintVersion(tree);
  if (installedEslintVersion) {
    const eslintMajorVersion = major(installedEslintVersion);
    return versionMap[eslintMajorVersion as CompatVersions] ?? latestVersions;
  }
  // No ESLint declared yet — fresh installs always go to the latest supported
  // ESLint stack (v9 + typescript-eslint v8). The eslintrc config shape is
  // still respected at the config-file level when `useFlatConfig(tree)` is
  // false; only the installed package versions move forward.
  return latestVersions;
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
