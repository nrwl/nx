import { type Tree } from '@nx/devkit';
import {
  getDeclaredPackageVersion,
  getInstalledPackageVersion,
} from '@nx/devkit/internal';
import { join } from 'path';
import { major } from 'semver';

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

// Pins dependency versions for supported ESLint majors that aren't the default
// (latest) stack so existing workspaces aren't force-bumped. Only v9 is mapped
// for now; the v10 entry will be added alongside full v10 support.
type CompatVersions = 9;
const versionMap: Record<CompatVersions, EslintVersions> = {
  9: { eslintVersion: '^9.8.0', typescriptESLintVersion: '^8.40.0' },
};

export function versions(tree: Tree): EslintVersions {
  const installedEslintVersion = getInstalledEslintVersion(tree);
  if (installedEslintVersion) {
    const eslintMajorVersion = major(installedEslintVersion);
    return versionMap[eslintMajorVersion as CompatVersions] ?? latestVersions;
  }
  // No ESLint declared yet, so fresh installs go to the latest supported stack.
  return latestVersions;
}

export function getInstalledEslintVersion(tree?: Tree): string | null {
  if (!tree) {
    return getInstalledPackageVersion('eslint');
  }
  return getDeclaredPackageVersion(tree, 'eslint');
}
