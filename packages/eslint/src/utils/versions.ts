import { type Tree } from '@nx/devkit';
import {
  getDeclaredPackageVersion,
  getInstalledPackageVersion,
} from '@nx/devkit/internal';
import { join } from 'path';

export const nxVersion = require(join('@nx/eslint', 'package.json')).version;

export const minSupportedEslintVersion = '9.0.0';

export const eslintConfigPrettierVersion = '^10.0.0';
export const eslintrcVersion = '^3.0.0';
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

export function versions(_tree: Tree): EslintVersions {
  return latestVersions;
}

export function getInstalledEslintVersion(tree?: Tree): string | null {
  if (!tree) {
    return getInstalledPackageVersion('eslint');
  }
  return getDeclaredPackageVersion(tree, 'eslint');
}
