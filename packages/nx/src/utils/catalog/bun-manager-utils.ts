import { applyEdits, modify } from 'jsonc-parser';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Tree } from '../../generators/tree';
import { readJsonFile } from '../fileutils';
import { parseJson } from '../json';
import { output } from '../output';
import type { CatalogDefinitions } from './types';

// Bun catalogs live in package.json, either at the top level or nested under
// the object form of `workspaces`.
interface BunPackageJson {
  workspaces?:
    | string[]
    | {
        packages?: string[];
        catalog?: Record<string, string>;
        catalogs?: Record<string, Record<string, string>>;
      };
  catalog?: Record<string, string>;
  catalogs?: Record<string, Record<string, string>>;
}

// Extracts catalog definitions from a parsed bun package.json, normalizing the
// top-level and `workspaces`-nested locations into a single CatalogDefinitions.
// Bun treats the locations as all-or-nothing: when either catalog field exists
// under `workspaces`, the top-level fields are ignored entirely rather than
// merged.
function normalizeBunCatalogDefinitions(
  packageJson: BunPackageJson
): CatalogDefinitions | null {
  const nested =
    packageJson.workspaces && !Array.isArray(packageJson.workspaces)
      ? packageJson.workspaces
      : undefined;

  const source =
    nested?.catalog !== undefined || nested?.catalogs !== undefined
      ? nested
      : packageJson;
  const { catalog, catalogs } = source;

  if (!catalog && !catalogs) {
    return null;
  }

  return { catalog, catalogs };
}

function readBunCatalogConfigFromFs(
  filename: string,
  fullPath: string
): CatalogDefinitions | null {
  try {
    return normalizeBunCatalogDefinitions(
      readJsonFile<BunPackageJson>(fullPath)
    );
  } catch (error) {
    output.warn({
      title: `Unable to parse ${filename}`,
      bodyLines: [error.toString()],
    });
    return null;
  }
}

function readBunCatalogConfigFromTree(
  filename: string,
  tree: Tree
): CatalogDefinitions | null {
  const content = tree.read(filename, 'utf-8');
  try {
    return normalizeBunCatalogDefinitions(parseJson<BunPackageJson>(content));
  } catch (error) {
    output.warn({
      title: `Unable to parse ${filename}`,
      bodyLines: [error.toString()],
    });
    return null;
  }
}

// Mirror of readCatalogDefinitions for bun's package.json-based catalogs: the
// fs (string-root) branch is cached per pass, the Tree branch stays live.
export function readBunCatalogDefinitions(
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
      ? readBunCatalogConfigFromFs(filename, configPath)
      : null;
    cache.set(treeOrRoot, defs);
    return defs;
  }

  if (!treeOrRoot.exists(filename)) {
    return null;
  }
  return readBunCatalogConfigFromTree(filename, treeOrRoot);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// Resolves the jsonc path a catalog update should target. Follows the same
// all-or-nothing routing as the reader: updates land in the `workspaces`
// location when it holds a catalog field, otherwise at the top level.
function resolveBunCatalogTargetPath(
  packageJson: BunPackageJson,
  packageName: string,
  catalogName: string | undefined
): string[] {
  const nested =
    packageJson.workspaces && !Array.isArray(packageJson.workspaces)
      ? packageJson.workspaces
      : undefined;
  const nestedIsActive =
    nested?.catalog !== undefined || nested?.catalogs !== undefined;
  const prefix = nestedIsActive ? ['workspaces'] : [];

  return catalogName
    ? [...prefix, 'catalogs', catalogName, packageName]
    : [...prefix, 'catalog', packageName];
}

// jsonc-parser's `modify` creates missing intermediate objects but throws on
// null (or other non-object) ones — the JSON counterpart of pnpm's empty
// `catalog:` placeholder. Walk the target path and, at the first non-object
// step, replace that node wholesale with the remaining path nested as fresh
// objects.
function planBunCatalogEdit(
  packageJson: BunPackageJson,
  targetPath: string[],
  version: string
): { path: string[]; value: unknown } {
  let node: unknown = packageJson;
  for (let i = 0; i < targetPath.length - 1; i++) {
    if (!isRecord(node)) {
      break;
    }
    const next = node[targetPath[i]];
    if (next !== undefined && !isRecord(next)) {
      const value = targetPath
        .slice(i + 1)
        .reduceRight((acc: unknown, key) => ({ [key]: acc }), version);
      return { path: targetPath.slice(0, i + 1), value };
    }
    node = next;
  }
  return { path: targetPath, value: version };
}

export function updateBunCatalogVersionsInFile(
  filename: string,
  treeOrRoot: Tree | string,
  updates: Array<{
    packageName: string;
    version: string;
    catalogName?: string;
  }>
): void {
  let checkExists: () => boolean;
  let readContent: () => string;
  let writeContent: (content: string) => void;

  if (typeof treeOrRoot === 'string') {
    const configPath = join(treeOrRoot, filename);
    checkExists = () => existsSync(configPath);
    readContent = () => readFileSync(configPath, 'utf-8');
    writeContent = (content) => writeFileSync(configPath, content, 'utf-8');
  } else {
    checkExists = () => treeOrRoot.exists(filename);
    readContent = () => treeOrRoot.read(filename, 'utf-8');
    writeContent = (content) => treeOrRoot.write(filename, content);
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
    let content = readContent();
    // parseJson surfaces a genuine syntax error here rather than letting a
    // broken file be silently rewritten.
    let packageJson = parseJson<BunPackageJson>(content);

    let hasChanges = false;
    for (const update of updates) {
      const { packageName, version, catalogName } = update;

      const targetPath = resolveBunCatalogTargetPath(
        packageJson,
        packageName,
        catalogName
      );

      // `modify` emits an edit even for an identical value, so check first to
      // keep an already-matching file untouched.
      const currentValue = targetPath.reduce(
        (node: unknown, key) => (isRecord(node) ? node[key] : undefined),
        packageJson
      );
      if (currentValue === version) {
        continue;
      }

      const { path, value } = planBunCatalogEdit(
        packageJson,
        targetPath,
        version
      );
      const edits = modify(content, path, value, {
        formattingOptions: { insertSpaces: true, tabSize: 2 },
      });
      if (edits.length > 0) {
        content = applyEdits(content, edits);
        // Re-parse so the next update routes against the just-applied edit
        // (e.g. a null `catalog` placeholder replaced with a fresh map).
        packageJson = parseJson<BunPackageJson>(content);
        hasChanges = true;
      }
    }

    if (hasChanges) {
      writeContent(content);
    }
  } catch (error) {
    output.error({
      title: 'Failed to update catalog versions',
      bodyLines: [error instanceof Error ? error.message : String(error)],
    });
    throw error;
  }
}
