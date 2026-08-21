import type { Tree } from '../../generators/tree';
import { readJson } from '../../generators/utils/json';
import type { PackageJson } from '../package-json';
import { workspaceRoot } from '../workspace-root';
import type { CatalogManager } from './manager';
import { getCatalogManager } from './manager-factory';

export { type CatalogManager, getCatalogManager };

/**
 * Dereferences a pnpm/yarn/bun catalog reference to a concrete version spec. Returns
 * the input unchanged when it is not a catalog reference (or no catalog manager
 * applies). Throws when the reference cannot be resolved.
 */
export function resolveCatalogReferenceIfNeeded(
  packageName: string,
  version: string
): string {
  const manager = getCatalogManager(workspaceRoot);
  if (!manager?.isCatalogReference(version)) {
    return version;
  }

  const resolvedVersion = manager.resolveCatalogReference(
    workspaceRoot,
    packageName,
    version
  );
  if (!resolvedVersion) {
    throw new Error(
      `Unable to resolve catalog reference ${packageName}@${version}.`
    );
  }

  return resolvedVersion;
}

/**
 * Resolves a package.json's `catalog:` dependency / devDependency specifiers to
 * their declared version range. Non-catalog or unresolvable specifiers are
 * returned unchanged.
 */
export function resolveCatalogSpecifiers(
  packageJson: PackageJson | null
): PackageJson | null {
  if (!packageJson) {
    return packageJson;
  }

  const resolveSection = (
    section: Record<string, string>
  ): Record<string, string> => {
    const resolved: Record<string, string> = {};
    for (const [name, specifier] of Object.entries(section)) {
      try {
        resolved[name] = resolveCatalogReferenceIfNeeded(name, specifier);
      } catch {
        resolved[name] = specifier;
      }
    }
    return resolved;
  };

  const result: PackageJson = { ...packageJson };
  if (packageJson.dependencies) {
    result.dependencies = resolveSection(packageJson.dependencies);
  }
  if (packageJson.devDependencies) {
    result.devDependencies = resolveSection(packageJson.devDependencies);
  }
  return result;
}

/**
 * Detects which packages in a package.json use catalog references
 * Returns Map of package name -> catalog name (undefined for default catalog)
 */
export function getCatalogDependenciesFromPackageJson(
  tree: Tree,
  packageJsonPath: string,
  manager: CatalogManager
): Map<string, string | undefined> {
  const catalogDeps = new Map<string, string | undefined>();

  if (!tree.exists(packageJsonPath)) {
    return catalogDeps;
  }

  try {
    const packageJson = readJson(tree, packageJsonPath);
    const allDependencies: Record<string, string> = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
      ...packageJson.peerDependencies,
      ...packageJson.optionalDependencies,
    };

    for (const [packageName, version] of Object.entries(
      allDependencies || {}
    )) {
      if (manager.isCatalogReference(version)) {
        const catalogRef = manager.parseCatalogReference(version);
        if (catalogRef) {
          catalogDeps.set(packageName, catalogRef.catalogName);
        }
      }
    }
  } catch (error) {
    // If we can't read the package.json, return empty map
  }

  return catalogDeps;
}
