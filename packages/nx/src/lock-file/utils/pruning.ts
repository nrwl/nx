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
 * Remove devDependencies if production target
 * Remove optional peerDependencies if production target
 *
 * @param packageJson
 * @param isProduction
 * @param projectName
 * @returns
 */
export function normalizePackageJson(
  packageJson: PackageJson,
  isProduction: boolean,
  projectName: string
): PackageJsonDeps {
  const normalized: PackageJsonDeps = {
    name: packageJson.name || projectName,
    version: packageJson.version || '0.0.0',
    ...(packageJson.license && { license: packageJson.license }),
  };
  if (packageJson.dependencies) {
    normalized.dependencies = packageJson.dependencies;
  }
  if (packageJson.devDependencies && !isProduction) {
    normalized.devDependencies = packageJson.devDependencies;
  }
  if (packageJson.peerDependencies) {
    if (isProduction) {
      const normalizedPeedDeps = filterOptionalPeerDependencies(packageJson);
      if (normalizedPeedDeps) {
        normalized.peerDependencies = normalizedPeedDeps;
      }
    } else {
      normalized.peerDependencies = packageJson.peerDependencies;
      if (packageJson.peerDependenciesMeta) {
        normalized.peerDependenciesMeta = packageJson.peerDependenciesMeta;
      }
    }
  }

  return normalized;
}

function filterOptionalPeerDependencies(
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
