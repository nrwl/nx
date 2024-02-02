import { readJsonFile } from '@nx/devkit';
import { existsSync } from 'fs';
import { PackageJson } from 'nx/src/utils/package-json';
import { isTerminalRun } from './runtime-lint-utils';

export function getAllDependencies(
  packageJson: PackageJson
): Record<string, string> {
  return {
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
    ...packageJson.peerDependencies,
    ...packageJson.optionalDependencies,
  };
}

export function getProductionDependencies(
  packageJsonPath: string
): Record<string, string> {
  if (
    !globalThis.projPackageJsonDeps ||
    !globalThis.projPackageJsonDeps[packageJsonPath] ||
    !isTerminalRun()
  ) {
    const packageJson = getPackageJson(packageJsonPath);
    globalThis.projPackageJsonDeps = globalThis.projPackageJsonDeps || {};
    globalThis.projPackageJsonDeps[packageJsonPath] = {
      ...packageJson.dependencies,
      ...packageJson.peerDependencies,
      ...packageJson.optionalDependencies,
    };
  }

  return globalThis.projPackageJsonDeps[packageJsonPath];
}

export function getPackageJson(path: string): PackageJson {
  if (existsSync(path)) {
    return readJsonFile(path);
  }
  return {} as PackageJson;
}
