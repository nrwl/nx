import { logger, type Tree } from 'nx/src/devkit-exports';
import type {
  ExportDeclaration,
  ExportSpecifier,
  Identifier,
  ImportDeclaration,
  ImportSpecifier,
  NamedExports,
  NamedImports,
  Node,
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

  // Top-level names declared in this file. A deprecated `*V2` import must NOT be
  // renamed to its canonical name when that name is already declared here — e.g.
  // a multi-version plugin that inlines its own `CreateNodesContext` extending
  // the devkit `CreateNodesContextV2`. Renaming the import would collide with,
  // or self-reference, the local declaration.
  const conflicts = collectLocalDeclarationNames(sourceFile);

  const changes: StringChange[] = [];
  // Local bindings whose name changes as a result of rewriting a non-aliased
  // import specifier (e.g. `import { CreateNodesV2 }` -> `import { CreateNodes }`).
  // Every in-body reference to such a binding must be renamed too, otherwise the
  // rewritten import leaves a dangling reference to the old name.
  const localRenames = new Map<string, string>();
  for (const stmt of sourceFile.statements) {
    if (ts.isImportDeclaration(stmt)) {
      collectImportRewrite(sourceFile, stmt, changes, localRenames, conflicts);
    } else if (ts.isExportDeclaration(stmt)) {
      collectExportRewrite(sourceFile, stmt, changes, conflicts);
    }
  }

  if (localRenames.size > 0) {
    collectUsageRewrites(sourceFile, localRenames, changes);
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
  changes: StringChange[],
  localRenames: Map<string, string>,
  conflicts: ReadonlySet<string>
): void {
  if (!isDevkitSpecifier(stmt.moduleSpecifier)) {
    return;
  }
  const namedBindings = stmt.importClause?.namedBindings;
  if (!namedBindings || !ts!.isNamedImports(namedBindings)) {
    return;
  }
  // A non-aliased specifier (`{ CreateNodesV2 }`) renames the local binding, so
  // its in-body references must be rewritten as well. An aliased specifier
  // (`{ CreateNodesV2 as Foo }`) keeps the local name `Foo`, so it does not.
  for (const el of namedBindings.elements) {
    if (el.propertyName) {
      continue;
    }
    const canonical = CREATE_NODES_V2_TYPE_RENAMES.get(el.name.text);
    // Skip when the canonical name is declared locally — the rewrite is
    // suppressed below, so the binding and its references stay on the V2 name.
    if (canonical && !conflicts.has(canonical)) {
      localRenames.set(el.name.text, canonical);
    }
  }
  rewriteNamedBindings(sourceFile, namedBindings, changes, conflicts);
}

/**
 * Renames in-body references (type annotations, value usages) of bindings that
 * were renamed by an import rewrite. References inside import/export
 * declarations are left to the binding rewrite, and member positions
 * (`foo.CreateNodesV2`, `NS.CreateNodesV2`) are not standalone references to the
 * imported binding, so they are skipped.
 */
function collectUsageRewrites(
  sourceFile: SourceFile,
  localRenames: Map<string, string>,
  changes: StringChange[]
): void {
  const visit = (node: Node): void => {
    if (
      ts!.isIdentifier(node) &&
      localRenames.has(node.text) &&
      isRenameableReference(node)
    ) {
      const start = node.getStart(sourceFile);
      changes.push(
        { type: ChangeType.Delete, start, length: node.getEnd() - start },
        {
          type: ChangeType.Insert,
          index: start,
          text: localRenames.get(node.text)!,
        }
      );
    }
    ts!.forEachChild(node, visit);
  };
  ts!.forEachChild(sourceFile, visit);
}

function isRenameableReference(id: Identifier): boolean {
  const parent = id.parent;
  // `foo.CreateNodesV2` — the member name is not the imported binding.
  if (ts!.isPropertyAccessExpression(parent) && parent.name === id) {
    return false;
  }
  // `NS.CreateNodesV2` in a type position — same reasoning.
  if (ts!.isQualifiedName(parent) && parent.right === id) {
    return false;
  }
  // Anything inside an import/export declaration is handled by the binding
  // rewrite; skip it here to avoid touching the specifier twice.
  for (let n: Node | undefined = id; n; n = n.parent) {
    if (ts!.isImportDeclaration(n) || ts!.isExportDeclaration(n)) {
      return false;
    }
  }
  return true;
}

function collectExportRewrite(
  sourceFile: SourceFile,
  stmt: ExportDeclaration,
  changes: StringChange[],
  conflicts: ReadonlySet<string>
): void {
  if (!stmt.moduleSpecifier || !isDevkitSpecifier(stmt.moduleSpecifier)) {
    return;
  }
  if (!stmt.exportClause || !ts!.isNamedExports(stmt.exportClause)) {
    return;
  }
  rewriteNamedBindings(sourceFile, stmt.exportClause, changes, conflicts);
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
  changes: StringChange[],
  conflicts: ReadonlySet<string>
): void {
  const elements = namedBindings.elements as readonly (
    | ImportSpecifier
    | ExportSpecifier
  )[];
  // Whether any specifier is actually renamed once the local-declaration guard
  // is applied. A non-aliased `{ V2 }` is suppressed when its canonical name is
  // declared locally, so a list whose only deprecated type hits that guard is
  // left untouched.
  const willRename = elements.some((el) => {
    const canonical = CREATE_NODES_V2_TYPE_RENAMES.get(
      (el.propertyName ?? el.name).text
    );
    if (!canonical) {
      return false;
    }
    return el.propertyName ? true : !conflicts.has(canonical);
  });
  if (!willRename) {
    return;
  }

  const seen = new Set<string>();
  const rendered: string[] = [];
  for (const el of elements) {
    const text = renderSpecifier(el, conflicts);
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

function renderSpecifier(
  el: ImportSpecifier | ExportSpecifier,
  conflicts: ReadonlySet<string>
): string {
  const typePrefix = el.isTypeOnly ? 'type ' : '';
  const rename = (name: string) =>
    CREATE_NODES_V2_TYPE_RENAMES.get(name) ?? name;

  // `{ name }` — no alias, so the local binding follows the rename, unless the
  // canonical name is already declared locally (keep the V2 name to avoid a
  // collision with — or self-reference to — that declaration).
  if (!el.propertyName) {
    const canonical = rename(el.name.text);
    if (canonical !== el.name.text && conflicts.has(canonical)) {
      return `${typePrefix}${el.name.text}`;
    }
    return `${typePrefix}${canonical}`;
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

/**
 * Collects the names of top-level type/value declarations in the file. A
 * deprecated `*V2` import is not renamed to a canonical name that appears here,
 * since doing so would collide with the local declaration.
 */
function collectLocalDeclarationNames(
  sourceFile: SourceFile
): ReadonlySet<string> {
  const names = new Set<string>();
  for (const stmt of sourceFile.statements) {
    if (
      (ts!.isInterfaceDeclaration(stmt) ||
        ts!.isTypeAliasDeclaration(stmt) ||
        ts!.isClassDeclaration(stmt) ||
        ts!.isFunctionDeclaration(stmt) ||
        ts!.isEnumDeclaration(stmt)) &&
      stmt.name
    ) {
      names.add(stmt.name.text);
    } else if (ts!.isVariableStatement(stmt)) {
      for (const decl of stmt.declarationList.declarations) {
        if (ts!.isIdentifier(decl.name)) {
          names.add(decl.name.text);
        }
      }
    }
  }
  return names;
}
