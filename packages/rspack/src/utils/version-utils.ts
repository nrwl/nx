import { type Tree } from '@nx/devkit';
import {
  getDeclaredPackageVersion,
  getInstalledPackageVersion,
  readModulePackageJson,
} from '@nx/devkit/internal';
import { dirname } from 'path';
import { major } from 'semver';
import {
  backwardCompatibleRspackVersions,
  latestRspackVersions,
  type SupportedRspackMajorVersion,
} from './versions';

const RSPACK_CORE_PACKAGE = '@rspack/core';

export function getInstalledRspackMajorVersion(
  tree: Tree
): SupportedRspackMajorVersion | undefined {
  const declared = getDeclaredPackageVersion(tree, RSPACK_CORE_PACKAGE);
  if (!declared) {
    return undefined;
  }
  const installedMajor = major(declared);
  return installedMajor in backwardCompatibleRspackVersions
    ? (installedMajor as SupportedRspackMajorVersion)
    : undefined;
}

// `rspack serve` loads the dev server through the CLI, so resolve the CLI
// from the project and the dev server from the CLI
export function getRspackDevServerMajorVersion(
  projectDir: string
): number | null {
  let cliDir: string;
  try {
    cliDir = dirname(readModulePackageJson('@rspack/cli', [projectDir]).path);
  } catch {
    return null;
  }
  const version = getInstalledPackageVersion('@rspack/dev-server', [cliDir]);
  return version ? major(version) : null;
}

// Reads the version off an already-resolved `@rspack/core` module instance
// (e.g. `compiler.rspack`) — avoids a second resolution at runtime.
export function getRspackCoreMajorVersion(
  rspackCore: typeof import('@rspack/core')
): number {
  return major(rspackCore.rspackVersion ?? '1.0.0');
}

export function getRspackVersionsForInstalledMajor(tree: Tree) {
  const installed = getInstalledRspackMajorVersion(tree);
  if (installed === undefined) {
    return latestRspackVersions;
  }
  return backwardCompatibleRspackVersions[installed];
}
