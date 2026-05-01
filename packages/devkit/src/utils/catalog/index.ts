import { readJson, type Tree } from 'nx/src/devkit-exports';
import { getCatalogManager } from './manager-factory';
import type { CatalogManager } from './manager';

export { type CatalogManager, getCatalogManager };

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
