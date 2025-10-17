import { dump, load } from '@zkochan/js-yaml';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Tree } from '../../generators/tree';
import { readYamlFile } from '../fileutils';
import { output } from '../output';
import type { PnpmCatalogEntry, PnpmWorkspaceYaml } from '../pnpm-workspace';
import type { CatalogManager } from './manager';
import type { CatalogReference } from './types';

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
    return ['pnpm-workspace.yaml'];
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
      // Check both locations for default catalog
      catalogToUse =
        workspaceConfig.catalog ?? workspaceConfig.catalogs?.default;
    } else if (catalogRef.catalogName) {
      catalogToUse = workspaceConfig.catalogs?.[catalogRef.catalogName];
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

    const workspaceConfig = this.getCatalogDefinitions(treeOrRoot);
    if (!workspaceConfig) {
      throw new Error(
        formatCatalogError(
          'Cannot get Pnpm catalog definitions. No pnpm-workspace.yaml found in workspace root.',
          ['Create a pnpm-workspace.yaml file in your workspace root']
        )
      );
    }

    let catalogToUse: PnpmCatalogEntry | undefined;

    if (catalogRef.isDefaultCatalog) {
      const hasCatalog = !!workspaceConfig.catalog;
      const hasCatalogsDefault = !!workspaceConfig.catalogs?.default;

      // Error if both defined (matches pnpm behavior)
      if (hasCatalog && hasCatalogsDefault) {
        throw new Error(
          "The 'default' catalog was defined multiple times. Use the 'catalog' field or 'catalogs.default', but not both."
        );
      }

      catalogToUse =
        workspaceConfig.catalog ?? workspaceConfig.catalogs?.default;
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

        throw new Error(
          formatCatalogError(
            'No default catalog defined in pnpm-workspace.yaml',
            suggestions
          )
        );
      }
    } else if (catalogRef.catalogName) {
      catalogToUse = workspaceConfig.catalogs?.[catalogRef.catalogName];
      if (!catalogToUse) {
        const availableCatalogs = Object.keys(
          workspaceConfig.catalogs || {}
        ).filter((c) => c !== 'default');
        const defaultCatalog = !!workspaceConfig.catalog
          ? 'catalog'
          : !workspaceConfig.catalogs?.default
          ? 'catalogs.default'
          : null;

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
        if (defaultCatalog) {
          suggestions.push(`Or use the default catalog ("${defaultCatalog}")`);
        }

        throw new Error(
          formatCatalogError(
            `Catalog "${catalogRef.catalogName}" not found in pnpm-workspace.yaml`,
            suggestions
          )
        );
      }
    }

    if (!catalogToUse![packageName]) {
      let catalogName: string;
      if (catalogRef.isDefaultCatalog) {
        // Context-aware messaging based on which location exists
        const hasCatalog = !!workspaceConfig.catalog;
        catalogName = hasCatalog
          ? 'default catalog ("catalog")'
          : 'default catalog ("catalogs.default")';
      } else {
        catalogName = `catalog '${catalogRef.catalogName}'`;
      }

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
        const normalizedCatalogName =
          catalogName === 'default' ? undefined : catalogName;

        let targetCatalog: PnpmCatalogEntry;
        if (!normalizedCatalogName) {
          // Default catalog - update whichever exists, prefer catalog over catalogs.default
          if (workspaceData.catalog) {
            targetCatalog = workspaceData.catalog;
          } else if (workspaceData.catalogs?.default) {
            targetCatalog = workspaceData.catalogs.default;
          } else {
            // Neither exists, create catalog (shorthand syntax)
            workspaceData.catalog ??= {};
            targetCatalog = workspaceData.catalog;
          }
        } else {
          // Named catalog
          workspaceData.catalogs ??= {};
          workspaceData.catalogs[normalizedCatalogName] ??= {};
          targetCatalog = workspaceData.catalogs[normalizedCatalogName];
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

function formatCatalogError(error: string, suggestions: string[]): string {
  let message = error;

  if (suggestions && suggestions.length > 0) {
    message += '\n\nSuggestions:';
    suggestions.forEach((suggestion) => {
      message += `\n  • ${suggestion}`;
    });
  }

  return message;
}
