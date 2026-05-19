import { load } from '@zkochan/js-yaml';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { output, type Tree } from 'nx/src/devkit-exports';
import { readYamlFile } from 'nx/src/devkit-internals';
import {
  Document,
  isAlias,
  isMap,
  isScalar,
  parseDocument,
  YAMLMap,
  type Node,
} from 'yaml';
import type { CatalogDefinitions } from './types';

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

export function readCatalogConfigFromFs(
  filename: string,
  fullPath: string
): CatalogDefinitions | null {
  try {
    return readYamlFile<CatalogDefinitions>(fullPath);
  } catch (error) {
    output.warn({
      title: `Unable to parse ${filename}`,
      bodyLines: [error.toString()],
    });
    return null;
  }
}

export function readCatalogConfigFromTree(
  filename: string,
  tree: Tree
): CatalogDefinitions | null {
  const content = tree.read(filename, 'utf-8');
  try {
    return load(content, { filename }) as CatalogDefinitions;
  } catch (error) {
    output.warn({
      title: `Unable to parse ${filename}`,
      bodyLines: [error.toString()],
    });
    return null;
  }
}

export function updateCatalogVersionsInFile(
  filename: string,
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
    const configPath = join(treeOrRoot, filename);
    checkExists = () => existsSync(configPath);
    readYaml = () => readFileSync(configPath, 'utf-8');
    writeYaml = (content) => writeFileSync(configPath, content, 'utf-8');
  } else {
    checkExists = () => treeOrRoot.exists(filename);
    readYaml = () => treeOrRoot.read(filename, 'utf-8');
    writeYaml = (content) => treeOrRoot.write(filename, content);
  }

  if (!checkExists()) {
    output.warn({
      title: `No ${filename} found`,
      bodyLines: [
        `Cannot update catalog versions without a ${filename} file.`,
        `Create a ${filename} file to use catalogs.`,
      ],
    });
    return;
  }

  try {
    // parseDocument keeps comments and anchors so a catalog bump doesn't
    // rewrite the user's config file.
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
