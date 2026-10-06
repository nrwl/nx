import type { Tree } from '../../generators/tree';
import {
  collectCatalogReferencesForPackage,
  formatCatalogError,
  type CatalogManager,
} from './manager';
import {
  readCatalogDefinitions,
  updateCatalogVersionsInFile,
} from './manager-utils';
import type {
  CatalogDefinitions,
  CatalogEntry,
  CatalogReference,
  CatalogReferenceMatch,
} from './types';

const YARNRC_FILENAME = '.yarnrc.yml';

/**
 * Yarn Berry (v4.10+) catalog manager implementation.
 *
 * Unlike pnpm, the name "default" is not special: `catalog:` resolves only
 * against `catalog`, and `catalog:default` against `catalogs.default`.
 */
export class YarnCatalogManager implements CatalogManager {
  readonly name = 'yarn';
  readonly catalogProtocol = 'catalog:';
  // Parsed fs-root definitions, cached per pass. See readCatalogDefinitions.
  private definitionsByRoot = new Map<string, CatalogDefinitions | null>();

  isCatalogReference(version: string): boolean {
    return version.startsWith(this.catalogProtocol);
  }

  parseCatalogReference(version: string): CatalogReference | null {
    if (!this.isCatalogReference(version)) {
      return null;
    }

    const catalogName = version.substring(this.catalogProtocol.length);
    // Only an empty name selects the default catalog; unlike pnpm, "default"
    // is a regular named catalog in yarn.
    const isDefault = !catalogName;

    return {
      catalogName: isDefault ? undefined : catalogName,
      isDefaultCatalog: isDefault,
    };
  }

  getCatalogDefinitionFilePaths(): string[] {
    return [YARNRC_FILENAME];
  }

  getCatalogDefinitions(treeOrRoot: Tree | string): CatalogDefinitions | null {
    return readCatalogDefinitions(
      YARNRC_FILENAME,
      treeOrRoot,
      this.definitionsByRoot
    );
  }

  resolveCatalogReference(
    treeOrRoot: Tree | string,
    packageName: string,
    version: string
  ): string | null {
    const catalogRef = this.parseCatalogReference(version);
    if (!catalogRef) {
      return null;
    }

    const catalogDefs = this.getCatalogDefinitions(treeOrRoot);
    if (!catalogDefs) {
      return null;
    }

    let catalogToUse: CatalogEntry | undefined;
    if (catalogRef.isDefaultCatalog) {
      catalogToUse = catalogDefs.catalog;
    } else if (catalogRef.catalogName) {
      catalogToUse = catalogDefs.catalogs?.[catalogRef.catalogName];
    }

    return catalogToUse?.[packageName] || null;
  }

  getCatalogReferencesForPackage(
    treeOrRoot: Tree | string,
    packageName: string
  ): CatalogReferenceMatch[] {
    return collectCatalogReferencesForPackage(this, treeOrRoot, packageName);
  }

  validateCatalogReference(
    treeOrRoot: Tree | string,
    packageName: string,
    version: string
  ): void {
    const catalogRef = this.parseCatalogReference(version);
    if (!catalogRef) {
      throw new Error(
        `Invalid catalog reference syntax: "${version}". Expected format: "catalog:" or "catalog:name"`
      );
    }

    const catalogDefs = this.getCatalogDefinitions(treeOrRoot);
    if (!catalogDefs) {
      throw new Error(
        formatCatalogError(
          `Cannot get Yarn catalog definitions. No ${YARNRC_FILENAME} found in workspace root.`,
          [`Create a ${YARNRC_FILENAME} file in your workspace root`]
        )
      );
    }

    let catalogToUse: CatalogEntry | undefined;

    if (catalogRef.isDefaultCatalog) {
      // Yarn's default catalog is only the `catalog` field; unlike pnpm,
      // `catalogs.default` does not act as a fallback.
      catalogToUse = catalogDefs.catalog;
      if (!catalogToUse) {
        const availableCatalogs = Object.keys(catalogDefs.catalogs || {});

        const suggestions = [
          `Define a default catalog in ${YARNRC_FILENAME} under the "catalog" key`,
        ];
        if (availableCatalogs.length > 0) {
          suggestions.push(
            `Or select from the available named catalogs: ${availableCatalogs
              .map((c) => `"catalog:${c}"`)
              .join(', ')}`
          );
        }

        throw new Error(
          formatCatalogError(
            `No default catalog defined in ${YARNRC_FILENAME}`,
            suggestions
          )
        );
      }
    } else if (catalogRef.catalogName) {
      catalogToUse = catalogDefs.catalogs?.[catalogRef.catalogName];
      if (!catalogToUse) {
        const availableCatalogs = Object.keys(catalogDefs.catalogs || {});

        const suggestions = [
          `Define the catalog in ${YARNRC_FILENAME} under the "catalogs" key`,
        ];
        if (availableCatalogs.length > 0) {
          suggestions.push(
            `Or select from the available named catalogs: ${availableCatalogs
              .map((c) => `"catalog:${c}"`)
              .join(', ')}`
          );
        }
        if (catalogDefs.catalog) {
          suggestions.push(`Or use the default catalog ("catalog:")`);
        }

        throw new Error(
          formatCatalogError(
            `Catalog "${catalogRef.catalogName}" not found in ${YARNRC_FILENAME}`,
            suggestions
          )
        );
      }
    }

    if (!catalogToUse![packageName]) {
      const catalogName = catalogRef.isDefaultCatalog
        ? 'default catalog ("catalog")'
        : `catalog '${catalogRef.catalogName}'`;

      const availablePackages = Object.keys(catalogToUse!);
      const suggestions = [
        `Add "${packageName}" to ${catalogName} in ${YARNRC_FILENAME}`,
      ];
      if (availablePackages.length > 0) {
        suggestions.push(
          `Or select from the available packages in ${catalogName}: ${availablePackages
            .map((p) => `"${p}"`)
            .join(', ')}`
        );
      }

      throw new Error(
        formatCatalogError(
          `Package "${packageName}" not found in ${catalogName}`,
          suggestions
        )
      );
    }
  }

  updateCatalogVersions(
    treeOrRoot: Tree | string,
    updates: Array<{
      packageName: string;
      version: string;
      catalogName?: string;
    }>
  ): void {
    updateCatalogVersionsInFile(YARNRC_FILENAME, treeOrRoot, updates, {
      aliasDefaultCatalog: false,
    });
  }
}
