import { type Tree } from '@nx/devkit';
import {
  getInstalledPackageVersion,
  getResolvedPackageVersion,
} from '@nx/devkit/internal';
import { join } from 'path';
import { lt, major } from 'semver';
import { useFlatConfig } from './flat-config';

export const nxVersion = require(join('@nx/eslint', 'package.json')).version;

export const minSupportedEslintVersion = '9.0.0';

export const eslintConfigPrettierVersion = '^10.0.0';
export const eslintrcVersion = '^3.3.0';
export const jsoncEslintParserVersion = '^2.1.0';
export const eslintCompat = '^2.0.5';

export const eslintVersion = '^10.0.0';
export const eslintV9Version = '^9.8.0';
export const typescriptESLintVersion = '^8.58.0';

type EslintVersions = {
  eslintVersion: string;
  typescriptESLintVersion: string;
};

const latestVersions: EslintVersions = {
  eslintVersion,
  typescriptESLintVersion,
};

// Pins dependency versions for supported ESLint majors that aren't the default
// (latest) stack so existing workspaces aren't force-bumped to v10.
type CompatVersions = 9;
const versionMap: Record<CompatVersions, EslintVersions> = {
  9: { eslintVersion: eslintV9Version, typescriptESLintVersion: '^8.58.0' },
};

export function versions(tree: Tree): EslintVersions {
  assertEslintrcFormatSupported(tree);
  const installedEslintVersion = getInstalledEslintVersion(tree);
  if (installedEslintVersion) {
    return (
      versionMap[major(installedEslintVersion) as CompatVersions] ??
      latestVersions
    );
  }
  // Fresh install: latest stack (v10) by default. A workspace that stays on
  // eslintrc gets v9, the last major that reads it, so the scaffolded config
  // stays readable. Angular 20 and Next.js < 16 get v9 too: no release of
  // angular-eslint 20 or eslint-config-next < 16 supports ESLint v10. A
  // workspace that declares a package below its ESLint v10 floor gets v9 too.
  return useFlatConfig(tree) && !declaresPackageWithoutEslintV10Support(tree)
    ? latestVersions
    : versionMap[9];
}

// The packages a flat-config generator adds while keeping a declared version,
// each with its first release whose eslint peer range admits v10. A workspace
// that declares one below its floor stays on v9.
export const ESLINT_V10_FLOORS = {
  'angular-eslint': '21.3.0',
  '@angular-eslint/eslint-plugin': '21.3.0',
  '@eslint/compat': '2.0.2',
  // 16.0-16.3 admit v10 in their peer range, but the React plugins they
  // bundle fail on it.
  'eslint-config-next': '16.4.0',
  '@nuxt/eslint-config': '1.15.0',
  '@typescript-eslint/parser': '8.56.0',
  '@typescript-eslint/rule-tester': '8.56.0',
  '@typescript-eslint/utils': '8.56.0',
  '@vue/eslint-config-typescript': '14.7.0',
  'eslint-plugin-import-x': '4.16.2',
  'eslint-plugin-react-hooks': '7.1.0',
  'eslint-plugin-vue': '10.8.0',
  'typescript-eslint': '8.56.0',
  'vue-eslint-parser': '10.3.0',
};

function declaresPackageWithoutEslintV10Support(tree: Tree): boolean {
  const angularVersion = getResolvedPackageVersion(tree, '@angular/core');
  const nextVersion = getResolvedPackageVersion(tree, 'next');
  return (
    (!!angularVersion && major(angularVersion) < 21) ||
    (!!nextVersion && major(nextVersion) < 16) ||
    Object.entries(ESLINT_V10_FLOORS).some(([name, floor]) => {
      const version = getResolvedPackageVersion(tree, name);
      return !!version && lt(version, floor);
    })
  );
}

// convert-to-flat-config runs only on eslintrc workspaces, which
// `assertSupportedEslintVersion` pins at ESLint >= 9. Preserve the workspace's
// major there: keep v9 on v9 (its plugins have no v10 release), never force
// v10, and never downgrade a v10 workspace. Default to v9 when unresolved.
export function getConvertToFlatConfigVersions(tree: Tree): EslintVersions {
  const installedEslintVersion = getInstalledEslintVersion(tree);
  const eslintMajorVersion = installedEslintVersion
    ? major(installedEslintVersion)
    : 9;
  return eslintMajorVersion >= 10 ? latestVersions : versionMap[9];
}

export function assertEslintrcFormatSupported(tree: Tree): void {
  if (process.env.ESLINT_USE_FLAT_CONFIG !== 'false') {
    return;
  }
  const installedEslintVersion = getInstalledEslintVersion(tree);
  const eslintMajorVersion = installedEslintVersion
    ? major(installedEslintVersion)
    : undefined;
  if (eslintMajorVersion >= 10) {
    throw new Error(
      `ESLint v${eslintMajorVersion} does not support the legacy "eslintrc" configuration format, but ESLINT_USE_FLAT_CONFIG=false was set. ` +
        `Unset the environment variable to scaffold a flat config, or downgrade ESLint to v9.`
    );
  }
}

export function getInstalledEslintVersion(tree?: Tree): string | null {
  if (!tree) {
    return getInstalledPackageVersion('eslint');
  }
  return getResolvedPackageVersion(tree, 'eslint');
}
