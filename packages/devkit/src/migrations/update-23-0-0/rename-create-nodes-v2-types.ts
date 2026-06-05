import { logger, type Tree } from 'nx/src/devkit-exports';
import type {
  ExportDeclaration,
  ExportSpecifier,
  ImportDeclaration,
  ImportSpecifier,
  NamedExports,
  NamedImports,
  SourceFile,
} from 'typescript';
import { formatFiles } from '../../generators/format-files';
import { visitNotIgnoredFiles } from '../../generators/visit-not-ignored-files';
import { ensurePackage } from '../../utils/package-json';
import {
  applyChangesToString,
  ChangeType,
  type StringChange,
} from '../../utils/string-change';
import { typescriptVersion } from '../../utils/versions';

const TS_EXTENSIONS = ['.ts', '.tsx', '.cts', '.mts'] as const;
const DEVKIT_SPECIFIER = '@nx/devkit';

// The `*V2` plugin types were renamed to their canonical un-suffixed names in
// Nx 23. The `V2` names remain as `@deprecated` aliases, so this migration only
// moves callers onto the canonical names. (`CreateNodesResultV2` is renamed to
// `CreateNodesResultArray`, not `CreateNodesResult`, which is an unrelated type.)
export const CREATE_NODES_V2_TYPE_RENAMES: ReadonlyMap<string, string> =
  new Map([
    ['CreateNodesV2', 'CreateNodes'],
    ['CreateNodesContextV2', 'CreateNodesContext'],
    ['CreateNodesResultV2', 'CreateNodesResultArray'],
    ['CreateNodesFunctionV2', 'CreateNodesFunction'],
    ['NxPluginV2', 'NxPlugin'],
  ]);

let ts: typeof import('typescript') | undefined;

export default async function renameCreateNodesV2Types(
  tree: Tree
): Promise<void> {
  let touchedCount = 0;

  visitNotIgnoredFiles(tree, '.', (filePath) => {
    if (!TS_EXTENSIONS.some((ext) => filePath.endsWith(ext))) {
      return;
    }
    const original = tree.read(filePath, 'utf-8');
    if (!original || !original.includes('V2')) {
      return;
    }
    const updated = rewriteCreateNodesV2Types(original);
    if (updated !== original) {
      tree.write(filePath, updated);
      touchedCount += 1;
    }
  });

  if (touchedCount > 0) {
    logger.info(
      `Renamed deprecated CreateNodes V2 type imports from @nx/devkit in ${touchedCount} file(s).`
    );
  }

  await formatFiles(tree);
}

/**
 * Rewrites named imports and re-exports of the deprecated `*V2` plugin types
 * from `@nx/devkit` to their canonical names. Only the named bindings are
 * touched — the module specifier, the `import`/`export` keyword, any `type`
 * modifier, and any default import are left untouched.
 */
export function rewriteCreateNodesV2Types(source: string): string {
  ts ??= ensurePackage<typeof import('typescript')>(
    'typescript',
    typescriptVersion
  );
  const sourceFile = ts.createSourceFile(
    'tmp.ts',
    source,
    ts.ScriptTarget.Latest,
    /* setParentNodes */ true,
    ts.ScriptKind.TSX
  );

  const changes: StringChange[] = [];
  for (const stmt of sourceFile.statements) {
    if (ts.isImportDeclaration(stmt)) {
      collectImportRewrite(sourceFile, stmt, changes);
    } else if (ts.isExportDeclaration(stmt)) {
      collectExportRewrite(sourceFile, stmt, changes);
    }
  }

  return changes.length > 0 ? applyChangesToString(source, changes) : source;
}

function isDevkitSpecifier(
  node: ImportDeclaration['moduleSpecifier']
): boolean {
  return ts!.isStringLiteral(node) && node.text === DEVKIT_SPECIFIER;
}

function collectImportRewrite(
  sourceFile: SourceFile,
  stmt: ImportDeclaration,
  changes: StringChange[]
): void {
  if (!isDevkitSpecifier(stmt.moduleSpecifier)) {
    return;
  }
  const namedBindings = stmt.importClause?.namedBindings;
  if (!namedBindings || !ts!.isNamedImports(namedBindings)) {
    return;
  }
  rewriteNamedBindings(sourceFile, namedBindings, changes);
}

function collectExportRewrite(
  sourceFile: SourceFile,
  stmt: ExportDeclaration,
  changes: StringChange[]
): void {
  if (!stmt.moduleSpecifier || !isDevkitSpecifier(stmt.moduleSpecifier)) {
    return;
  }
  if (!stmt.exportClause || !ts!.isNamedExports(stmt.exportClause)) {
    return;
  }
  rewriteNamedBindings(sourceFile, stmt.exportClause, changes);
}

/**
 * Re-renders the `{ ... }` of a named import/export, renaming any deprecated
 * `*V2` type to its canonical name. If renaming would collide with a canonical
 * name that is already present, the duplicate is dropped. Returns without
 * recording a change when the binding list contains none of the renamed types.
 */
function rewriteNamedBindings(
  sourceFile: SourceFile,
  namedBindings: NamedImports | NamedExports,
  changes: StringChange[]
): void {
  const elements = namedBindings.elements as readonly (
    | ImportSpecifier
    | ExportSpecifier
  )[];
  const hasRenamed = elements.some((el) =>
    CREATE_NODES_V2_TYPE_RENAMES.has((el.propertyName ?? el.name).text)
  );
  if (!hasRenamed) {
    return;
  }

  const seen = new Set<string>();
  const rendered: string[] = [];
  for (const el of elements) {
    const text = renderSpecifier(el);
    if (!seen.has(text)) {
      seen.add(text);
      rendered.push(text);
    }
  }

  const start = namedBindings.getStart(sourceFile);
  changes.push(
    {
      type: ChangeType.Delete,
      start,
      length: namedBindings.getEnd() - start,
    },
    {
      type: ChangeType.Insert,
      index: start,
      text: `{ ${rendered.join(', ')} }`,
    }
  );
}

function renderSpecifier(el: ImportSpecifier | ExportSpecifier): string {
  const typePrefix = el.isTypeOnly ? 'type ' : '';
  const rename = (name: string) =>
    CREATE_NODES_V2_TYPE_RENAMES.get(name) ?? name;

  // `{ name }` — no alias, so the local binding follows the rename.
  if (!el.propertyName) {
    return `${typePrefix}${rename(el.name.text)}`;
  }

  // `{ propertyName as name }` — only the imported (left) side is renamed; the
  // local alias is preserved. A now-redundant alias such as
  // `CreateNodesV2 as CreateNodes` collapses to `CreateNodes`.
  const canonicalImported = rename(el.propertyName.text);
  const localName = el.name.text;
  return canonicalImported === localName
    ? `${typePrefix}${localName}`
    : `${typePrefix}${canonicalImported} as ${localName}`;
}
