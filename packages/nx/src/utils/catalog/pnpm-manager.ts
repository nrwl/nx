import { load } from '@zkochan/js-yaml';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  Document,
  isAlias,
  isMap,
  isScalar,
  parseDocument,
  YAMLMap,
  type Node,
} from 'yaml';
import type { Tree } from '../../generators/tree';
import { readYamlFile } from '../fileutils';
import { output } from '../output';
import { formatCatalogError, type CatalogManager } from './manager';
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
      // parseDocument keeps comments and anchors so a catalog bump doesn't
      // rewrite the user's pnpm-workspace.yaml.
      const doc = parseDocument(readYaml());

      let hasChanges = false;
      for (const update of updates) {
        const { packageName, version, catalogName } = update;
        const normalizedCatalogName =
          catalogName === 'default' ? undefined : catalogName;

        let targetPath: string[];
        if (!normalizedCatalogName) {
          // An empty `catalog:` placeholder must not claim the default route
          // when `catalogs.default` is populated — that would create a
          // duplicate-default config rejected by pnpm.
          if (isMapAt(doc, ['catalog'])) {
            targetPath = ['catalog', packageName];
          } else if (existsAt(doc, ['catalogs', 'default'])) {
            targetPath = ['catalogs', 'default', packageName];
          } else {
            targetPath = ['catalog', packageName];
          }
        } else {
          targetPath = ['catalogs', normalizedCatalogName, packageName];
        }

        if (getValueAt(doc, targetPath) !== version) {
          setThroughAliases(doc, targetPath, version);
          hasChanges = true;
        }
      }

      if (hasChanges) {
        writeYaml(String(doc));
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

// Walks `path` resolving aliases at every step so structural checks can
// see through `key: *anchor` references — neither `doc.getIn` nor
// `doc.hasIn` traverse aliases on their own. Returns the resolved node, or
// `undefined` if any ancestor isn't a map.
function resolveAt(doc: Document, path: string[]): Node | null | undefined {
  let node: Node | null | undefined = doc.contents;
  for (let i = 0; i < path.length; i++) {
    if (isAlias(node)) node = node.resolve(doc);
    if (!isMap(node)) return undefined;
    node = node.get(path[i], true) as Node | null | undefined;
  }
  if (isAlias(node)) node = node.resolve(doc);
  return node;
}

function isMapAt(doc: Document, path: string[]): boolean {
  return isMap(resolveAt(doc, path));
}

function existsAt(doc: Document, path: string[]): boolean {
  return resolveAt(doc, path) !== undefined;
}

// `doc.getIn` does not traverse aliases — for aliased paths it returns
// undefined even when the resolved node has a value. Use the alias-aware
// walk and unwrap scalar nodes to their JS value.
function getValueAt(doc: Document, path: string[]): unknown {
  const node = resolveAt(doc, path);
  return isScalar(node) ? node.value : node;
}

// Walks `targetPath` resolving aliases at every step and mutates the
// resolved map directly so anchors are preserved. When a step is missing
// or holds a null placeholder (`key:` with no value), creates a fresh map
// inside the current parent and transfers any attached comments from the
// placeholder so they aren't dropped. Falls back to `doc.setIn` only when
// the root isn't a map (e.g. an empty document), letting it bootstrap.
function setThroughAliases(
  doc: Document,
  targetPath: string[],
  value: unknown
): void {
  let parent: Node | null | undefined = doc.contents;
  if (isAlias(parent)) parent = parent.resolve(doc);
  for (let i = 0; i < targetPath.length - 1; i++) {
    if (!isMap(parent)) {
      doc.setIn(targetPath, value);
      return;
    }
    let next = parent.get(targetPath[i], true) as Node | null | undefined;
    if (isAlias(next)) next = next.resolve(doc);
    const placeholder =
      isScalar(next) && next.value === null ? next : undefined;
    if (next === undefined || placeholder) {
      let cur = parent;
      for (let j = i; j < targetPath.length - 1; j++) {
        const fresh = new YAMLMap();
        if (j === i && placeholder) {
          if (placeholder.comment) fresh.comment = placeholder.comment;
          if (placeholder.commentBefore)
            fresh.commentBefore = placeholder.commentBefore;
        }
        cur.set(targetPath[j], fresh);
        cur = fresh;
      }
      cur.set(targetPath[targetPath.length - 1], value);
      return;
    }
    parent = next;
  }
  if (!isMap(parent)) {
    doc.setIn(targetPath, value);
    return;
  }
  parent.set(targetPath[targetPath.length - 1], value);
}

function readConfigFromFs(path: string): CatalogDefinitions | null {
  try {
    return readYamlFile<CatalogDefinitions>(path);
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
): CatalogDefinitions | null {
  const content = tree.read(path, 'utf-8');

  try {
    return load(content, { filename: path }) as CatalogDefinitions;
  } catch (error) {
    output.warn({
      title: `Unable to parse ${PNPM_WORKSPACE_FILENAME}`,
      bodyLines: [error.toString()],
    });
    return null;
  }
}
