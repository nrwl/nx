import { PackageJson } from '../../utils/package-json';

type PackageJsonDeps = Pick<
  PackageJson,
  | 'dependencies'
  | 'devDependencies'
  | 'peerDependencies'
  | 'peerDependenciesMeta'
>;

/**
 * Strip off non-dependency related fields from package.json
 * Remove devDependencies if production target
 * Remove optional peerDependencies
 * @param packageJson
 * @param isProduction
 * @returns
 */
export function normalizePackageJson(
  packageJson: PackageJson,
  isProduction: boolean
): PackageJsonDeps {
  const normalized: PackageJsonDeps = {};
  if (packageJson.dependencies) {
    normalized.dependencies = packageJson.dependencies;
  }
  if (packageJson.devDependencies && !isProduction) {
    normalized.devDependencies = packageJson.devDependencies;
  }
  if (packageJson.peerDependencies) {
    const normalizedPeedDeps = normalizePeerDependencies(packageJson);
    if (normalizedPeedDeps) {
      normalized.peerDependencies = normalizedPeedDeps;
    }
  }
  return normalized;
}

function normalizePeerDependencies(
  packageJson: PackageJson
): Record<string, string> {
  let peerDependencies;
  Object.keys(packageJson.peerDependencies).forEach((key) => {
    if (!packageJson.peerDependenciesMeta?.[key]?.optional) {
      peerDependencies = peerDependencies || {};
      peerDependencies[key] = packageJson.peerDependencies[key];
    }
  });
  return peerDependencies;
}
