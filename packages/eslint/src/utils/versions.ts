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
export const eslintrcVersion = '^3.3.0';
export const jsoncEslintParserVersion = '^2.1.0';
export const eslintCompat = '^2.0.5';

export const eslintVersion = '^10.0.0';
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
  9: { eslintVersion: '^9.8.0', typescriptESLintVersion: '^8.58.0' },
};

export function versions(tree: Tree): EslintVersions {
  const installedEslintVersion = getInstalledEslintVersion(tree);
  const legacyRequested = process.env.ESLINT_USE_FLAT_CONFIG === 'false';
  if (installedEslintVersion) {
    const eslintMajorVersion = major(installedEslintVersion);
    if (legacyRequested && eslintMajorVersion >= 10) {
      throw new Error(
        `ESLint v${eslintMajorVersion} does not support the legacy "eslintrc" configuration format, but ESLINT_USE_FLAT_CONFIG=false was set. ` +
          `Unset the environment variable to scaffold a flat config, or downgrade ESLint to v9.`
      );
    }
    return versionMap[eslintMajorVersion as CompatVersions] ?? latestVersions;
  }
  // Fresh install: latest stack (v10) by default. If eslintrc is explicitly
  // requested via ESLINT_USE_FLAT_CONFIG=false, pin v9, the last major that
  // still supports eslintrc, so the scaffolded .eslintrc.json stays readable.
  // We check only the env var, not useFlatConfig(tree): its treeless fallback
  // reads the CLI's own eslint, unrelated to what we're about to install.
  return legacyRequested ? versionMap[9] : latestVersions;
}

// convert-to-flat-config runs only on eslintrc workspaces, which
// `assertSupportedEslintVersion` pins at ESLint >= 9. Preserve the installed
// major there: keep v9 on v9 (its plugins have no v10 release), never force
// v10, and never downgrade a v10 workspace. Default to v9 when unresolved.
export function getConvertToFlatConfigVersions(tree: Tree): EslintVersions {
  const installedEslintVersion = getInstalledEslintVersion(tree);
  const eslintMajorVersion = installedEslintVersion
    ? major(installedEslintVersion)
    : 9;
  return eslintMajorVersion >= 10 ? latestVersions : versionMap[9];
}

export function getInstalledEslintVersion(tree?: Tree): string | null {
  if (!tree) {
    return getInstalledPackageVersion('eslint');
  }
  return getDeclaredPackageVersion(tree, 'eslint');
}
