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

// `npm:<name>` or `npm:<name>@<range>`, where the name may be scoped
export function parseNpmAlias(
  versionExpr: string
): { name: string; range: string } | undefined {
  if (!versionExpr.startsWith('npm:')) {
    return undefined;
  }
  const spec = versionExpr.slice('npm:'.length);
  const at = spec.lastIndexOf('@');
  return at > 0
    ? { name: spec.slice(0, at), range: spec.slice(at + 1) || '*' }
    : { name: spec, range: '*' };
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
  | 'overrides'
  | 'pnpm'
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
    overrides,
    pnpm,
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
    overrides,
    pnpm,
  };
}
