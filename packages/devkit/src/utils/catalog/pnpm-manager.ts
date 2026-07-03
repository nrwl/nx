import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { type Tree } from 'nx/src/devkit-exports';
import { formatCatalogError, type CatalogManager } from './manager';
import {
  readCatalogConfigFromFs,
  readCatalogConfigFromTree,
  updateCatalogVersionsInFile,
} from './manager-utils';
import type {
  CatalogDefinitions,
  CatalogEntry,
  CatalogReference,
} from './types';

const PNPM_WORKSPACE_FILENAME = 'pnpm-workspace.yaml';

/**
 * PNPM-specific catalog manager implementation
 */
export class PnpmCatalogManager implements CatalogManager {
  readonly name = 'pnpm';
  readonly catalogProtocol = 'catalog:';
  // Parsed definitions cached per root. A manager is created per operation
  // (getCatalogManager news one up), so defs are read once per pass instead of
  // once per catalog reference. Only the fs (string-root) branch is cached; the
  // Tree branch stays live since the tree is mutable within a generator.
  private definitionsByRoot = new Map<string, CatalogDefinitions | null>();

  isCatalogReference(version: string): boolean {
    return version.startsWith(this.catalogProtocol);
  }

  parseCatalogReference(version: string): CatalogReference | null {
    if (!this.isCatalogReference(version)) {
      return null;
    }

    const catalogName = version.substring(this.catalogProtocol.length);
    // Normalize both "catalog:" and "catalog:default" to the same representation
    const isDefault = !catalogName || catalogName === 'default';

    return {
      catalogName: isDefault ? undefined : catalogName,
      isDefaultCatalog: isDefault,
    };
  }

  getCatalogDefinitionFilePaths(): string[] {
    return [PNPM_WORKSPACE_FILENAME];
  }

  getCatalogDefinitions(treeOrRoot: Tree | string): CatalogDefinitions | null {
    if (typeof treeOrRoot === 'string') {
      if (this.definitionsByRoot.has(treeOrRoot)) {
        return this.definitionsByRoot.get(treeOrRoot);
      }
      const configPath = join(treeOrRoot, PNPM_WORKSPACE_FILENAME);
      const defs = existsSync(configPath)
        ? readCatalogConfigFromFs(PNPM_WORKSPACE_FILENAME, configPath)
        : null;
      this.definitionsByRoot.set(treeOrRoot, defs);
      return defs;
    } else {
      if (!treeOrRoot.exists(PNPM_WORKSPACE_FILENAME)) {
        return null;
      }
      return readCatalogConfigFromTree(PNPM_WORKSPACE_FILENAME, treeOrRoot);
    }
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
      // Check both locations for default catalog
      catalogToUse = catalogDefs.catalog ?? catalogDefs.catalogs?.default;
    } else if (catalogRef.catalogName) {
      catalogToUse = catalogDefs.catalogs?.[catalogRef.catalogName];
    }

    return catalogToUse?.[packageName] || null;
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
          `Cannot get Pnpm catalog definitions. No ${PNPM_WORKSPACE_FILENAME} found in workspace root.`,
          [`Create a ${PNPM_WORKSPACE_FILENAME} file in your workspace root`]
        )
      );
    }

    let catalogToUse: CatalogEntry | undefined;

    if (catalogRef.isDefaultCatalog) {
      const hasCatalog = !!catalogDefs.catalog;
      const hasCatalogsDefault = !!catalogDefs.catalogs?.default;

      // Error if both defined (matches pnpm behavior)
      if (hasCatalog && hasCatalogsDefault) {
        throw new Error(
          "The 'default' catalog was defined multiple times. Use the 'catalog' field or 'catalogs.default', but not both."
        );
      }

      catalogToUse = catalogDefs.catalog ?? catalogDefs.catalogs?.default;
      if (!catalogToUse) {
        const availableCatalogs = Object.keys(catalogDefs.catalogs || {});

        const suggestions = [
          `Define a default catalog in ${PNPM_WORKSPACE_FILENAME} under the "catalog" key`,
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
            `No default catalog defined in ${PNPM_WORKSPACE_FILENAME}`,
            suggestions
          )
        );
      }
    } else if (catalogRef.catalogName) {
      catalogToUse = catalogDefs.catalogs?.[catalogRef.catalogName];
      if (!catalogToUse) {
        const availableCatalogs = Object.keys(
          catalogDefs.catalogs || {}
        ).filter((c) => c !== 'default');
        const defaultCatalog = !!catalogDefs.catalog
          ? 'catalog'
          : !catalogDefs.catalogs?.default
            ? 'catalogs.default'
            : null;

        const suggestions = [
          `Define the catalog in ${PNPM_WORKSPACE_FILENAME} under the "catalogs" key`,
        ];
        if (availableCatalogs.length > 0) {
          suggestions.push(
            `Or select from the available named catalogs: ${availableCatalogs
              .map((c) => `"catalog:${c}"`)
              .join(', ')}`
          );
        }
        if (defaultCatalog) {
          suggestions.push(`Or use the default catalog ("${defaultCatalog}")`);
        }

        throw new Error(
          formatCatalogError(
            `Catalog "${catalogRef.catalogName}" not found in ${PNPM_WORKSPACE_FILENAME}`,
            suggestions
          )
        );
      }
    }

    if (!catalogToUse![packageName]) {
      let catalogName: string;
      if (catalogRef.isDefaultCatalog) {
        // Context-aware messaging based on which location exists
        const hasCatalog = !!catalogDefs.catalog;
        catalogName = hasCatalog
          ? 'default catalog ("catalog")'
          : 'default catalog ("catalogs.default")';
      } else {
        catalogName = `catalog '${catalogRef.catalogName}'`;
      }

      const availablePackages = Object.keys(catalogToUse!);
      const suggestions = [
        `Add "${packageName}" to ${catalogName} in ${PNPM_WORKSPACE_FILENAME}`,
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
    updateCatalogVersionsInFile(PNPM_WORKSPACE_FILENAME, treeOrRoot, updates);
  }
}
