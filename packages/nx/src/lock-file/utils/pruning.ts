import { PackageJson } from '../../utils/package-json';

export type PackageJsonDeps = Pick<
  PackageJson,
  | 'name'
  | 'version'
  | 'license'
  | 'dependencies'
  | 'devDependencies'
  | 'peerDependencies'
  | 'peerDependenciesMeta'
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
): PackageJsonDeps {
  const {
    name,
    version,
    license,
    dependencies,
    devDependencies,
    peerDependencies,
    peerDependenciesMeta,
  } = packageJson;

  return {
    name,
    version,
    license,
    dependencies,
    devDependencies,
    peerDependencies,
    peerDependenciesMeta,
  };
}
