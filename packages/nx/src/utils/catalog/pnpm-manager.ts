import { dump, load } from '@zkochan/js-yaml';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Tree } from '../../generators/tree';
import { readYamlFile } from '../fileutils';
import { output } from '../output';
import type { PnpmCatalogEntry, PnpmWorkspaceYaml } from '../pnpm-workspace';
import { formatCatalogError, type CatalogManager } from './manager';
import type { CatalogReference } from './types';

const PNPM_WORKSPACE_FILENAME = 'pnpm-workspace.yaml';

/**
 * PNPM-specific catalog manager implementation
 */
export class PnpmCatalogManager implements CatalogManager {
  readonly name = 'pnpm';
  readonly catalogProtocol = 'catalog:';

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

  getCatalogDefinitions(treeOrRoot: Tree | string): PnpmWorkspaceYaml | null {
    if (typeof treeOrRoot === 'string') {
      const configPath = join(treeOrRoot, PNPM_WORKSPACE_FILENAME);
      if (!existsSync(configPath)) {
        return null;
      }
      return readConfigFromFs(configPath);
    } else {
      if (!treeOrRoot.exists(PNPM_WORKSPACE_FILENAME)) {
        return null;
      }
      return readConfigFromTree(treeOrRoot, PNPM_WORKSPACE_FILENAME);
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

    let catalogToUse: PnpmCatalogEntry | undefined;
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

    let catalogToUse: PnpmCatalogEntry | undefined;

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
    let checkExists: () => boolean;
    let readYaml: () => string;
    let writeYaml: (content: string) => void;

    if (typeof treeOrRoot === 'string') {
      const configPath = join(treeOrRoot, PNPM_WORKSPACE_FILENAME);
      checkExists = () => existsSync(configPath);
      readYaml = () => readFileSync(configPath, 'utf-8');
      writeYaml = (content) => writeFileSync(configPath, content, 'utf-8');
    } else {
      checkExists = () => treeOrRoot.exists(PNPM_WORKSPACE_FILENAME);
      readYaml = () => treeOrRoot.read(PNPM_WORKSPACE_FILENAME, 'utf-8');
      writeYaml = (content) =>
        treeOrRoot.write(PNPM_WORKSPACE_FILENAME, content);
    }

    if (!checkExists()) {
      output.warn({
        title: `No ${PNPM_WORKSPACE_FILENAME} found`,
        bodyLines: [
          `Cannot update catalog versions without a ${PNPM_WORKSPACE_FILENAME} file.`,
          `Create a ${PNPM_WORKSPACE_FILENAME} file to use catalogs.`,
        ],
      });
      return;
    }

    try {
      const configContent = readYaml();
      const configData = load(configContent) || {};

      let hasChanges = false;
      for (const update of updates) {
        const { packageName, version, catalogName } = update;
        const normalizedCatalogName =
          catalogName === 'default' ? undefined : catalogName;

        let targetCatalog: PnpmCatalogEntry;
        if (!normalizedCatalogName) {
          // Default catalog - update whichever exists, prefer catalog over catalogs.default
          if (configData.catalog) {
            targetCatalog = configData.catalog;
          } else if (configData.catalogs?.default) {
            targetCatalog = configData.catalogs.default;
          } else {
            // Neither exists, create catalog (shorthand syntax)
            configData.catalog ??= {};
            targetCatalog = configData.catalog;
          }
        } else {
          // Named catalog
          configData.catalogs ??= {};
          configData.catalogs[normalizedCatalogName] ??= {};
          targetCatalog = configData.catalogs[normalizedCatalogName];
        }

        if (targetCatalog[packageName] !== version) {
          targetCatalog[packageName] = version;
          hasChanges = true;
        }
      }

      if (hasChanges) {
        writeYaml(
          dump(configData, {
            indent: 2,
            quotingType: '"',
            forceQuotes: true,
          })
        );
      }
    } catch (error) {
      output.error({
        title: 'Failed to update catalog versions',
        bodyLines: [error instanceof Error ? error.message : String(error)],
      });
      throw error;
    }
  }
}

function readConfigFromFs(path: string): PnpmWorkspaceYaml | null {
  try {
    return readYamlFile<PnpmWorkspaceYaml>(path);
  } catch (error) {
    output.warn({
      title: `Unable to parse ${PNPM_WORKSPACE_FILENAME}`,
      bodyLines: [error.toString()],
    });
    return null;
  }
}

function readConfigFromTree(
  tree: Tree,
  path: string
): PnpmWorkspaceYaml | null {
  const content = tree.read(path, 'utf-8');

  try {
    return load(content, { filename: path }) as PnpmWorkspaceYaml;
  } catch (error) {
    output.warn({
      title: `Unable to parse ${PNPM_WORKSPACE_FILENAME}`,
      bodyLines: [error.toString()],
    });
    return null;
  }
}
