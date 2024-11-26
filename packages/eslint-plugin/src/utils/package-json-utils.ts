import { readJsonFile } from '@nx/devkit';
import { existsSync } from 'fs';
import type { PackageJson } from 'nx/src/utils/package-json';

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
  packageJson: PackageJson
): Record<string, string> {
  return {
    ...packageJson.dependencies,
    ...packageJson.peerDependencies,
    ...packageJson.optionalDependencies,
  };
}

export function getPackageJson(path: string): PackageJson {
  if (existsSync(path)) {
    return readJsonFile(path);
  }
  return {} as PackageJson;
}
