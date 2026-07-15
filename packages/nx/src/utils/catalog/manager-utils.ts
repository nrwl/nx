import { load } from '@zkochan/js-yaml';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  Document,
  isAlias,
  isMap,
  isScalar,
  LineCounter,
  parseDocument,
  visit,
  YAMLMap,
  type Node,
} from 'yaml';
import type { Tree } from '../../generators/tree';
import { readYamlFile } from '../fileutils';
import { output } from '../output';
import type { CatalogDefinitions } from './types';

// Walks `path` resolving aliases at every step so structural checks can
// see through `key: *anchor` references. Neither `doc.getIn` nor
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

// `doc.getIn` does not traverse aliases. For aliased paths it returns
// undefined even when the resolved node has a value. Use the alias-aware
// walk and unwrap scalar nodes to their JS value.
function getValueAt(doc: Document, path: string[]): unknown {
  const node = resolveAt(doc, path);
  return isScalar(node) ? node.value : node;
}

// Walks `targetPath` resolving aliases at every step and mutates the
// resolved map directly so anchors are preserved. When a step is missing
// or holds a null placeholder (`key:` with no value), creates a fresh map
// inside the current parent and carries over the placeholder's comments
// and anchor so they aren't dropped. A dropped anchor would leave any
// alias referencing it unresolved and make `String(doc)` throw. Falls back
// to `doc.setIn` when the current parent isn't a map: an empty-document
// root gets bootstrapped, while a non-map value where a catalog map was
// expected makes `setIn` throw, surfacing the malformed config.
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
    const nextWasAlias = isAlias(next);
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
          // Copy the anchor only for a directly-held placeholder. When it
          // was reached through an alias, the anchor still lives on the
          // definition node, so re-emitting it here would duplicate it.
          if (!nextWasAlias && placeholder.anchor)
            fresh.anchor = placeholder.anchor;
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

function readCatalogConfigFromFs(
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

function readCatalogConfigFromTree(
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

// Managers are created per operation (getCatalogManager news one up), so the
// fs (string-root) branch is cached to read the file once per pass instead of
// once per catalog reference. The Tree branch stays live since the tree is
// mutable within a generator.
export function readCatalogDefinitions(
  filename: string,
  treeOrRoot: Tree | string,
  cache: Map<string, CatalogDefinitions | null>
): CatalogDefinitions | null {
  if (typeof treeOrRoot === 'string') {
    if (cache.has(treeOrRoot)) {
      return cache.get(treeOrRoot);
    }
    const configPath = join(treeOrRoot, filename);
    const defs = existsSync(configPath)
      ? readCatalogConfigFromFs(filename, configPath)
      : null;
    cache.set(treeOrRoot, defs);
    return defs;
  }

  if (!treeOrRoot.exists(filename)) {
    return null;
  }
  return readCatalogConfigFromTree(filename, treeOrRoot);
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
    const lineCounter = new LineCounter();
    const doc = parseDocument(readYaml(), { lineCounter });

    // parseDocument collects syntax errors instead of throwing; surface them
    // now, with their line/column detail, rather than failing later in
    // `String(doc)` with a generic message or skipping a no-op write on a
    // malformed file (the previous js-yaml `load()` threw here).
    if (doc.errors.length > 0) {
      throw new Error(doc.errors.map((e) => e.message).join('\n'));
    }

    // A dangling alias (`*ref` with no matching `&ref`) is not a syntax error,
    // so parseDocument leaves it out of doc.errors. Surface it here with the
    // same line/column detail the old js-yaml `load()` reported; otherwise a
    // broken reference is silently overwritten or written back untouched.
    const unresolvedAliases: string[] = [];
    visit(doc, {
      Alias(_key, node) {
        if (node.resolve(doc) !== undefined) return;
        const pos = node.range ? lineCounter.linePos(node.range[0]) : undefined;
        unresolvedAliases.push(
          pos
            ? `Unresolved alias "${node.source}" at line ${pos.line}, column ${pos.col}`
            : `Unresolved alias "${node.source}"`
        );
      },
    });
    if (unresolvedAliases.length > 0) {
      throw new Error(unresolvedAliases.join('\n'));
    }

    let hasChanges = false;
    for (const update of updates) {
      const { packageName, version, catalogName } = update;
      const normalizedCatalogName =
        catalogName === 'default' ? undefined : catalogName;

      let targetPath: string[];
      if (!normalizedCatalogName) {
        // An empty `catalog:` placeholder must not claim the default route
        // when `catalogs.default` is populated; that would create a
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
