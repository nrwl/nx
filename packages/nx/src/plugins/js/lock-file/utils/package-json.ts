import { PackageJson } from '../../../../utils/package-json';
import { workspaceRoot } from '../../../../utils/workspace-root';
import { readJsonFile } from '../../../../utils/fileutils';

/**
 * Get version of hoisted package if available
 */
export function getHoistedPackageVersion(packageName: string): string {
  const fullPath = `${workspaceRoot}/node_modules/${packageName}/package.json`;

  try {
    return readJsonFile(fullPath)?.version;
  } catch (e) {
    return;
  }
}

export type NormalizedPackageJson = Pick<
  PackageJson,
  | 'name'
  | 'version'
  | 'license'
  | 'dependencies'
  | 'devDependencies'
  | 'peerDependencies'
  | 'peerDependenciesMeta'
  | 'optionalDependencies'
  | 'packageManager'
  | 'resolutions'
>;

/**
 * Strip off non-pruning related fields from package.json
 */
export function normalizePackageJson(
  packageJson: PackageJson
): NormalizedPackageJson {
  const {
    name,
    version,
    license,
    dependencies,
    devDependencies,
    peerDependencies,
    peerDependenciesMeta,
    optionalDependencies,
    packageManager,
    resolutions,
  } = packageJson;

  return {
    name,
    version,
    license,
    dependencies,
    devDependencies,
    peerDependencies,
    peerDependenciesMeta,
    optionalDependencies,
    packageManager,
    resolutions,
  };
}
