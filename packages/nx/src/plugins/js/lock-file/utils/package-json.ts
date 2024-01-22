import { existsSync, readFileSync } from 'fs';
import { PackageJson } from '../../../../utils/package-json';
import { workspaceRoot } from '../../../../utils/workspace-root';

/**
 * Get version of hoisted package if available
 */
export function getHoistedPackageVersion(packageName: string): string {
  const fullPath = `${workspaceRoot}/node_modules/${packageName}/package.json`;

  if (existsSync(fullPath)) {
    const content = readFileSync(fullPath, 'utf-8');
    return JSON.parse(content)?.version;
  }
  return;
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
  };
}
