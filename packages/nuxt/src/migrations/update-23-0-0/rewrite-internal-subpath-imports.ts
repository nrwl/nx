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
  CallExpression,
  ExportDeclaration,
  ExportSpecifier,
  ImportDeclaration,
  ImportSpecifier,
  ImportTypeNode,
  Node,
  SourceFile,
  StringLiteral,
} from 'typescript';

const TS_EXTENSIONS = ['.ts', '.tsx', '.cts', '.mts'] as const;
const FROM_PREFIX = '@nx/nuxt/src/';
const TO_PUBLIC = '@nx/nuxt';
const TO_INTERNAL = '@nx/nuxt/internal';

// Symbols exported from `@nx/nuxt`'s public entry (packages/nuxt/index.ts).
// A named import/export of one of these from `@nx/nuxt/src/*` is routed to
// the public `@nx/nuxt` entry; everything else goes to `@nx/nuxt/internal`.
const PUBLIC_SYMBOLS: ReadonlySet<string> = new Set([
  'applicationGenerator',
  'InitSchema',
  'nuxtInitGenerator',
  'storybookConfigurationGenerator',
]);

// Methods on `jest` and `vi` that take a module specifier as their first arg.
const MOCK_HELPER_METHODS: ReadonlySet<string> = new Set([
  'mock',
  'unmock',
  'doMock',
  'dontMock',
  'requireActual',
  'requireMock',
  'importActual',
  'importMock',
]);

let ts: typeof import('typescript') | undefined;

export default async function rewriteInternalSubpathImports(
  tree: Tree
): Promise<void> {
  let touchedCount = 0;

  visitNotIgnoredFiles(tree, '.', (filePath) => {
    if (!TS_EXTENSIONS.some((ext) => filePath.endsWith(ext))) {
      return;
    }
    const original = tree.read(filePath, 'utf-8');
    if (!original || !original.includes(FROM_PREFIX)) {
      return;
    }
    const updated = rewriteSubpathImports(original);
    if (updated !== original) {
      tree.write(filePath, updated);
      touchedCount += 1;
    }
  });

  if (touchedCount > 0) {
    logger.info(
      `Rewrote @nx/nuxt/src/* imports in ${touchedCount} file(s) ` +
        `(public symbols to @nx/nuxt, internals to @nx/nuxt/internal).`
    );
  }

  await formatFiles(tree);
}

export function rewriteSubpathImports(source: string): string {
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
      collectImportRewrite(sourceFile, stmt, changes);
    } else if (ts.isExportDeclaration(stmt)) {
      collectExportRewrite(sourceFile, stmt, changes);
    }
  }
  collectCallExpressionRewrites(sourceFile, changes);

  return changes.length > 0 ? applyChangesToString(source, changes) : source;
}

function isSubpathSpecifier(node: Node): node is StringLiteral {
  return ts!.isStringLiteral(node) && node.text.startsWith(FROM_PREFIX);
}

function collectImportRewrite(
  sourceFile: SourceFile,
  stmt: ImportDeclaration,
  changes: StringChange[]
): void {
  if (!isSubpathSpecifier(stmt.moduleSpecifier)) {
    return;
  }
  const clause = stmt.importClause;
  // Pure named imports (`import { a, b } from '...'`) can be split by symbol.
  // A default or namespace import grabs the whole module, so it can't be
  // split — route it wholesale to the internal entry.
  if (
    clause &&
    !clause.name &&
    clause.namedBindings &&
    ts!.isNamedImports(clause.namedBindings)
  ) {
    rewriteNamedDeclaration(
      sourceFile,
      stmt,
      stmt.moduleSpecifier,
      clause.isTypeOnly,
      clause.namedBindings.elements,
      'import',
      changes
    );
    return;
  }
  replaceSpecifier(sourceFile, stmt.moduleSpecifier, TO_INTERNAL, changes);
}

function collectExportRewrite(
  sourceFile: SourceFile,
  stmt: ExportDeclaration,
  changes: StringChange[]
): void {
  if (!stmt.moduleSpecifier || !isSubpathSpecifier(stmt.moduleSpecifier)) {
    return;
  }
  // `export { a, b } from '...'` can be split; `export * from '...'` cannot.
  if (stmt.exportClause && ts!.isNamedExports(stmt.exportClause)) {
    rewriteNamedDeclaration(
      sourceFile,
      stmt,
      stmt.moduleSpecifier,
      stmt.isTypeOnly,
      stmt.exportClause.elements,
      'export',
      changes
    );
    return;
  }
  replaceSpecifier(sourceFile, stmt.moduleSpecifier, TO_INTERNAL, changes);
}

/**
 * Partition the named bindings of an import/export declaration into the ones
 * that resolve to `@nx/nuxt`'s public entry and the ones that don't. If both
 * groups are non-empty, the single declaration is split into two.
 */
function rewriteNamedDeclaration(
  sourceFile: SourceFile,
  decl: ImportDeclaration | ExportDeclaration,
  specifier: StringLiteral,
  isTypeOnly: boolean,
  elements: readonly (ImportSpecifier | ExportSpecifier)[],
  keyword: 'import' | 'export',
  changes: StringChange[]
): void {
  const publicEls: (ImportSpecifier | ExportSpecifier)[] = [];
  const internalEls: (ImportSpecifier | ExportSpecifier)[] = [];
  for (const el of elements) {
    // `propertyName` is the original name in `orig as alias`; fall back to
    // `name` for the plain `orig` form.
    const importedName = (el.propertyName ?? el.name).text;
    (PUBLIC_SYMBOLS.has(importedName) ? publicEls : internalEls).push(el);
  }

  if (publicEls.length === 0) {
    replaceSpecifier(sourceFile, specifier, TO_INTERNAL, changes);
    return;
  }
  if (internalEls.length === 0) {
    replaceSpecifier(sourceFile, specifier, TO_PUBLIC, changes);
    return;
  }

  // Mixed — replace the whole declaration with one statement per target.
  const quote = sourceFile.text.charAt(specifier.getStart(sourceFile));
  const start = decl.getStart(sourceFile);
  const end = decl.getEnd();
  const semicolon = sourceFile.text.charAt(end - 1) === ';' ? ';' : '';
  const prefix = isTypeOnly ? `${keyword} type` : keyword;
  const render = (
    els: (ImportSpecifier | ExportSpecifier)[],
    target: string
  ): string =>
    `${prefix} { ${els
      .map((el) => el.getText(sourceFile))
      .join(', ')} } from ${quote}${target}${quote}${semicolon}`;

  changes.push(
    { type: ChangeType.Delete, start, length: end - start },
    {
      type: ChangeType.Insert,
      index: start,
      text: `${render(publicEls, TO_PUBLIC)}\n${render(
        internalEls,
        TO_INTERNAL
      )}`,
    }
  );
}

function collectCallExpressionRewrites(
  sourceFile: SourceFile,
  changes: StringChange[]
): void {
  const visit = (node: Node): void => {
    if (
      ts!.isCallExpression(node) &&
      shouldRewriteCallExpression(node) &&
      node.arguments.length >= 1 &&
      isSubpathSpecifier(node.arguments[0])
    ) {
      // `require(...)`, dynamic `import(...)` and `jest.mock(...)` reference
      // the module as a whole and can't be symbol-split, so they go to the
      // internal entry.
      replaceSpecifier(
        sourceFile,
        node.arguments[0] as StringLiteral,
        TO_INTERNAL,
        changes
      );
    } else if (ts!.isImportTypeNode(node)) {
      // `typeof import('...')` parses as an `ImportTypeNode`, not a
      // CallExpression — its argument is `LiteralTypeNode<StringLiteral>`.
      // The whole module is referenced, so it can't be symbol-split.
      const literal = getImportTypeStringLiteral(node);
      if (literal && literal.text.startsWith(FROM_PREFIX)) {
        replaceSpecifier(sourceFile, literal, TO_INTERNAL, changes);
      }
    }
    ts!.forEachChild(node, visit);
  };
  visit(sourceFile);
}

function getImportTypeStringLiteral(
  node: ImportTypeNode
): StringLiteral | undefined {
  const arg = node.argument;
  if (arg && ts!.isLiteralTypeNode(arg) && ts!.isStringLiteral(arg.literal)) {
    return arg.literal;
  }
  return undefined;
}

function shouldRewriteCallExpression(call: CallExpression): boolean {
  const callee = call.expression;
  // `require('...')`
  if (ts!.isIdentifier(callee) && callee.text === 'require') return true;
  // dynamic `import('...')` (runtime form parses as a CallExpression whose
  // callee is the `import` keyword). The `typeof import('...')` type-position
  // form is an `ImportTypeNode` (handled in `collectCallExpressionRewrites`).
  if (callee.kind === ts!.SyntaxKind.ImportKeyword) return true;
  // `jest.mock(...)` / `vi.mock(...)` and friends.
  if (ts!.isPropertyAccessExpression(callee)) {
    const obj = callee.expression;
    if (
      ts!.isIdentifier(obj) &&
      (obj.text === 'jest' || obj.text === 'vi') &&
      MOCK_HELPER_METHODS.has(callee.name.text)
    ) {
      return true;
    }
  }
  return false;
}

function replaceSpecifier(
  sourceFile: SourceFile,
  literal: StringLiteral,
  target: string,
  changes: StringChange[]
): void {
  const start = literal.getStart(sourceFile);
  const end = literal.getEnd();
  const quote = sourceFile.text.charAt(start);
  changes.push(
    { type: ChangeType.Delete, start, length: end - start },
    {
      type: ChangeType.Insert,
      index: start,
      text: `${quote}${target}${quote}`,
    }
  );
}
