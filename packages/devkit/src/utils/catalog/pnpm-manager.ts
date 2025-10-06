import { dump, load } from '@zkochan/js-yaml';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { output, type Tree } from 'nx/src/devkit-exports';
import { readYamlFile } from 'nx/src/devkit-internals';
import type {
  PnpmCatalogEntry,
  PnpmWorkspaceYaml,
} from 'nx/src/utils/pnpm-workspace';
import type { CatalogManager } from './manager';
import {
  type CatalogError,
  CatalogErrorType,
  type CatalogReference,
} from './types';

/**
 * PNPM-specific catalog manager implementation
 */
export class PnpmCatalogManager implements CatalogManager {
  readonly name = 'pnpm';
  readonly catalogProtocol = 'catalog:';

  supportsCatalogs(): boolean {
    return true;
  }

  isCatalogReference(version: string): boolean {
    return version.startsWith(this.catalogProtocol);
  }

  parseCatalogReference(version: string): CatalogReference | null {
    if (!this.isCatalogReference(version)) {
      return null;
    }

    const catalogName = version.substring(this.catalogProtocol.length);

    return {
      catalogName: catalogName || undefined,
      isDefaultCatalog: catalogName === '',
    };
  }

  getCatalogDefinitions(treeOrRoot: Tree | string): PnpmWorkspaceYaml | null {
    if (typeof treeOrRoot === 'string') {
      const pnpmWorkspacePath = join(treeOrRoot, 'pnpm-workspace.yaml');
      if (!existsSync(pnpmWorkspacePath)) {
        return null;
      }
      return readYamlFileFromFs(pnpmWorkspacePath);
    } else {
      if (!treeOrRoot.exists('pnpm-workspace.yaml')) {
        return null;
      }
      return readYamlFileFromTree(treeOrRoot, 'pnpm-workspace.yaml');
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

    const workspaceConfig = this.getCatalogDefinitions(treeOrRoot);
    if (!workspaceConfig) {
      return null;
    }

    let catalogToUse: PnpmCatalogEntry | undefined;
    if (catalogRef.isDefaultCatalog) {
      catalogToUse = workspaceConfig.catalog;
    } else if (catalogRef.catalogName) {
      catalogToUse = workspaceConfig.catalogs?.[catalogRef.catalogName];
    }

    return catalogToUse?.[packageName] || null;
  }

  validateCatalogReference(
    treeOrRoot: Tree | string,
    packageName: string,
    version: string
  ): { isValid: boolean; error?: CatalogError } {
    const catalogRef = this.parseCatalogReference(version);
    if (!catalogRef) {
      return {
        isValid: false,
        error: {
          type: CatalogErrorType.INVALID_SYNTAX,
          message: `Invalid catalog reference syntax: "${version}". Expected format: "catalog:" or "catalog:name"`,
        },
      };
    }

    const workspaceConfig = this.getCatalogDefinitions(treeOrRoot);
    if (!workspaceConfig) {
      return {
        isValid: false,
        error: {
          type: CatalogErrorType.WORKSPACE_NOT_FOUND,
          message: 'No pnpm-workspace.yaml found in workspace root',
          suggestions: [
            'Create a pnpm-workspace.yaml file in your workspace root',
          ],
        },
      };
    }

    let catalogToUse: PnpmCatalogEntry | undefined;

    if (catalogRef.isDefaultCatalog) {
      catalogToUse = workspaceConfig.catalog;
      if (!catalogToUse) {
        const availableCatalogs = Object.keys(workspaceConfig.catalogs || {});

        const suggestions = [
          'Define a default catalog in pnpm-workspace.yaml under the "catalog" key',
        ];
        if (availableCatalogs.length > 0) {
          suggestions.push(
            `Or select from the available named catalogs: ${availableCatalogs
              .map((c) => `"catalog:${c}"`)
              .join(', ')}`
          );
        }

        return {
          isValid: false,
          error: {
            type: CatalogErrorType.CATALOG_NOT_FOUND,
            message: 'No default catalog defined in pnpm-workspace.yaml',
            suggestions,
          },
        };
      }
    } else if (catalogRef.catalogName) {
      catalogToUse = workspaceConfig.catalogs?.[catalogRef.catalogName];
      if (!catalogToUse) {
        const availableCatalogs = Object.keys(workspaceConfig.catalogs || {});
        const hasDefaultCatalog = !!workspaceConfig.catalog;

        const suggestions = [
          'Define the catalog in pnpm-workspace.yaml under the "catalogs" key',
        ];
        if (availableCatalogs.length > 0) {
          suggestions.push(
            `Or select from the available named catalogs: ${availableCatalogs
              .map((c) => `"catalog:${c}"`)
              .join(', ')}`
          );
        }
        if (hasDefaultCatalog) {
          suggestions.push('Or use the default catalog: "catalog:"');
        }

        return {
          isValid: false,
          error: {
            type: CatalogErrorType.CATALOG_NOT_FOUND,
            message: `Catalog "${catalogRef.catalogName}" not found in pnpm-workspace.yaml`,
            catalogName: catalogRef.catalogName,
            suggestions,
          },
        };
      }
    }

    if (!catalogToUse![packageName]) {
      const catalogName = catalogRef.isDefaultCatalog
        ? 'default catalog'
        : `catalog '${catalogRef.catalogName}'`;

      const availablePackages = Object.keys(catalogToUse!);
      const suggestions = [
        `Add "${packageName}" to ${catalogName} in pnpm-workspace.yaml`,
      ];
      if (availablePackages.length > 0) {
        suggestions.push(
          `Or select from the available packages in ${catalogName}: ${availablePackages
            .map((p) => `"${p}"`)
            .join(', ')}`
        );
      }

      return {
        isValid: false,
        error: {
          type: CatalogErrorType.PACKAGE_NOT_FOUND,
          message: `Package "${packageName}" not found in ${catalogName}`,
          packageName,
          catalogName: catalogRef.catalogName,
          suggestions,
        },
      };
    }

    return { isValid: true };
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
      const workspaceYamlPath = join(treeOrRoot, 'pnpm-workspace.yaml');
      checkExists = () => existsSync(workspaceYamlPath);
      readYaml = () => readFileSync(workspaceYamlPath, 'utf-8');
      writeYaml = (content) =>
        writeFileSync(workspaceYamlPath, content, 'utf-8');
    } else {
      checkExists = () => treeOrRoot.exists('pnpm-workspace.yaml');
      readYaml = () => treeOrRoot.read('pnpm-workspace.yaml', 'utf-8');
      writeYaml = (content) => treeOrRoot.write('pnpm-workspace.yaml', content);
    }

    if (!checkExists()) {
      output.warn({
        title: 'No pnpm-workspace.yaml found',
        bodyLines: [
          'Cannot update catalog versions without a pnpm-workspace.yaml file.',
          'Create a pnpm-workspace.yaml file to use catalogs.',
        ],
      });
      return;
    }

    try {
      const workspaceContent = readYaml();
      const workspaceData = load(workspaceContent) || {};

      let hasChanges = false;
      for (const update of updates) {
        const { packageName, version, catalogName } = update;

        let targetCatalog: PnpmCatalogEntry;
        if (catalogName) {
          // Named catalog
          workspaceData.catalogs ??= {};
          workspaceData.catalogs[catalogName] ??= {};
          targetCatalog = workspaceData.catalogs[catalogName];
        } else {
          // Default catalog
          workspaceData.catalog ??= {};
          targetCatalog = workspaceData.catalog;
        }

        if (targetCatalog[packageName] !== version) {
          targetCatalog[packageName] = version;
          hasChanges = true;
        }
      }

      if (hasChanges) {
        writeYaml(
          dump(workspaceData, {
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

function readYamlFileFromFs(path: string): PnpmWorkspaceYaml | null {
  try {
    return readYamlFile<PnpmWorkspaceYaml>(path);
  } catch (error) {
    output.warn({
      title: 'Unable to parse pnpm-workspace.yaml',
      bodyLines: [error.toString()],
    });
    return null;
  }
}

function readYamlFileFromTree(tree: Tree, path: string): PnpmWorkspaceYaml {
  const content = tree.read(path, 'utf-8');
  const { load } = require('@zkochan/js-yaml');

  try {
    return load(content, { filename: path }) as PnpmWorkspaceYaml;
  } catch (error) {
    output.warn({
      title: 'Unable to parse pnpm-workspace.yaml',
      bodyLines: [error.toString()],
    });
    return null;
  }
}
