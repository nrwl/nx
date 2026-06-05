import {
  applyChangesToString,
  ChangeType,
  ensurePackage,
  formatFiles,
  logger,
  type StringChange,
  type Tree,
  visitNotIgnoredFiles,
} from '@nx/devkit';
import type {
  ExportDeclaration,
  ExportSpecifier,
  ImportDeclaration,
  ImportSpecifier,
  NamedExports,
  NamedImports,
  SourceFile,
} from 'typescript';

const TS_EXTENSIONS = ['.ts', '.tsx', '.cts', '.mts'] as const;
const DEPRECATED_NAME = 'createNodesV2';
const CANONICAL_NAME = 'createNodes';

// Module specifiers from which `@nx/docker` publicly exposes `createNodesV2`.
// A named import or re-export of `createNodesV2` from one of these is rewritten
// to the canonical `createNodes` export.
const TARGET_SPECIFIERS: ReadonlySet<string> = new Set(['@nx/docker']);

let ts: typeof import('typescript') | undefined;

export default async function migrateCreateNodesV2ToCreateNodes(
  tree: Tree
): Promise<void> {
  let touchedCount = 0;

  visitNotIgnoredFiles(tree, '.', (filePath) => {
    if (!TS_EXTENSIONS.some((ext) => filePath.endsWith(ext))) {
      return;
    }
    const original = tree.read(filePath, 'utf-8');
    if (!original || !original.includes(DEPRECATED_NAME)) {
      return;
    }
    const updated = rewriteCreateNodesV2Imports(original, TARGET_SPECIFIERS);
    if (updated !== original) {
      tree.write(filePath, updated);
      touchedCount += 1;
    }
  });

  if (touchedCount > 0) {
    logger.info(
      `Renamed \`${DEPRECATED_NAME}\` imports to \`${CANONICAL_NAME}\` in ${touchedCount} file(s).`
    );
  }

  await formatFiles(tree);
}

/**
 * Rewrites named imports and re-exports of `createNodesV2` to `createNodes`
 * when they come from one of the given module specifiers. Only the named
 * bindings are touched — the module specifier, the `import`/`export` keyword,
 * any `type` modifier, and any default import are left untouched.
 */
export function rewriteCreateNodesV2Imports(
  source: string,
  specifiers: ReadonlySet<string>
): string {
  ts ??= ensurePackage<typeof import('typescript')>('typescript', '*');
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
      collectImportRewrite(sourceFile, stmt, specifiers, changes);
    } else if (ts.isExportDeclaration(stmt)) {
      collectExportRewrite(sourceFile, stmt, specifiers, changes);
    }
  }

  return changes.length > 0 ? applyChangesToString(source, changes) : source;
}

function isTargetSpecifier(
  node: ImportDeclaration['moduleSpecifier'],
  specifiers: ReadonlySet<string>
): boolean {
  return ts!.isStringLiteral(node) && specifiers.has(node.text);
}

function collectImportRewrite(
  sourceFile: SourceFile,
  stmt: ImportDeclaration,
  specifiers: ReadonlySet<string>,
  changes: StringChange[]
): void {
  if (!isTargetSpecifier(stmt.moduleSpecifier, specifiers)) {
    return;
  }
  const namedBindings = stmt.importClause?.namedBindings;
  // Only `import { ... }` carries renameable named bindings. `import x`,
  // `import * as ns`, and side-effect imports reference the module wholesale
  // and keep working through the `createNodesV2` runtime alias, so we leave
  // them be. A mixed `import def, { createNodesV2 }` still has its named
  // bindings rewritten below — the default binding is untouched.
  if (!namedBindings || !ts!.isNamedImports(namedBindings)) {
    return;
  }
  rewriteNamedBindings(sourceFile, namedBindings, changes);
}

function collectExportRewrite(
  sourceFile: SourceFile,
  stmt: ExportDeclaration,
  specifiers: ReadonlySet<string>,
  changes: StringChange[]
): void {
  if (
    !stmt.moduleSpecifier ||
    !isTargetSpecifier(stmt.moduleSpecifier, specifiers)
  ) {
    return;
  }
  // `export { ... } from '...'` can be rewritten; `export * from '...'` has no
  // named bindings to rename.
  if (!stmt.exportClause || !ts!.isNamedExports(stmt.exportClause)) {
    return;
  }
  rewriteNamedBindings(sourceFile, stmt.exportClause, changes);
}

/**
 * Re-renders the `{ ... }` of a named import/export, renaming any
 * `createNodesV2` specifier to `createNodes`. If renaming would collide with a
 * `createNodes` that is already present (e.g. `{ createNodes, createNodesV2 }`),
 * the duplicate is dropped. Returns without recording a change when the binding
 * list contains no `createNodesV2`.
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
  const hasDeprecated = elements.some(
    (el) => (el.propertyName ?? el.name).text === DEPRECATED_NAME
  );
  if (!hasDeprecated) {
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
    name === DEPRECATED_NAME ? CANONICAL_NAME : name;

  // `{ name }` — no alias, so the local binding follows the rename.
  if (!el.propertyName) {
    return `${typePrefix}${rename(el.name.text)}`;
  }

  // `{ propertyName as name }` — only the imported (left) side is renamed; the
  // local alias is preserved. A now-redundant alias such as
  // `createNodesV2 as createNodes` collapses to `createNodes`.
  const canonicalImported = rename(el.propertyName.text);
  const localName = el.name.text;
  return canonicalImported === localName
    ? `${typePrefix}${localName}`
    : `${typePrefix}${canonicalImported} as ${localName}`;
}
