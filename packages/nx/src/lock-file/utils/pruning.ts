import { PackageJson } from '../../utils/package-json';

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
 *
 * @param packageJson
 * @param isProduction
 * @param projectName
 * @returns
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
