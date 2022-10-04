import { satisfies } from 'semver';
import { defaultHashing } from '../../hasher/hashing-impl';
import { PackageVersions } from './lock-file-type';
import { workspaceRoot } from '../workspace-root';
import { existsSync, readFileSync } from 'fs';

/**
 * Simple sort function to ensure keys are ordered alphabetically
 * @param obj
 * @returns
 */
export function sortObject<T = string>(
  obj: Record<string, T>,
  valueTransformator: (value: T) => any = (value) => value,
  descending = false
): Record<string, T> | undefined {
  const keys = Object.keys(obj);
  if (keys.length === 0) {
    return;
  }
  keys.sort();
  if (descending) {
    keys.reverse();
  }
  const result: Record<string, T> = {};
  keys.forEach((key) => {
    result[key] = valueTransformator(obj[key]);
  });
  return result;
}

/**
 * Apply simple hashing of the content using the default hashing implementation
 * @param fileContent
 * @returns
 */
export function hashString(fileContent: string): string {
  return defaultHashing.hashArray([fileContent]);
}

export function findMatchingVersion(
  packageName: string,
  packageVersions: PackageVersions,
  version: string
): string {
  // if it's fixed version, just return it
  if (packageVersions[`${packageName}@${version}`]) {
    return version;
  }
  // otherwise search for the matching version
  return Object.values(packageVersions).find((v) =>
    satisfies(v.version, version)
  )?.version;
}

export function isRootVersion(packageName: string, version: string): boolean {
  const fullPath = `${workspaceRoot}/node_modules/${packageName}/package.json`;
  if (existsSync(fullPath)) {
    const content = readFileSync(fullPath, 'utf-8');
    return JSON.parse(content).version === version;
  } else {
    return false;
  }
  return true;
}
