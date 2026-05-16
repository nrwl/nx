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
import type { CallExpression, Node, SourceFile } from 'typescript';

const TS_EXTENSIONS = ['.ts', '.tsx', '.cts', '.mts'] as const;
const FROM_PREFIX = '@nx/jest/src/';
const TO_SPECIFIER = '@nx/jest/internal';

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
      `Rewrote @nx/jest/src/* imports to @nx/jest/internal in ${touchedCount} file(s).`
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
  collectImportRewrites(sourceFile, changes);
  collectCallExpressionRewrites(sourceFile, changes);

  return changes.length > 0 ? applyChangesToString(source, changes) : source;
}

function shouldRewriteSpecifier(specifier: string): boolean {
  return specifier.startsWith(FROM_PREFIX);
}

function collectImportRewrites(
  sourceFile: SourceFile,
  changes: StringChange[]
): void {
  for (const stmt of sourceFile.statements) {
    if (!ts!.isImportDeclaration(stmt)) continue;
    if (!ts!.isStringLiteral(stmt.moduleSpecifier)) continue;
    if (!shouldRewriteSpecifier(stmt.moduleSpecifier.text)) continue;
    replaceSpecifier(sourceFile, stmt.moduleSpecifier, changes);
  }
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
      ts!.isStringLiteral(node.arguments[0]) &&
      shouldRewriteSpecifier(node.arguments[0].text)
    ) {
      replaceSpecifier(sourceFile, node.arguments[0], changes);
    }
    ts!.forEachChild(node, visit);
  };
  visit(sourceFile);
}

function shouldRewriteCallExpression(call: CallExpression): boolean {
  const callee = call.expression;
  // `require('...')`
  if (ts!.isIdentifier(callee) && callee.text === 'require') return true;
  // dynamic `import('...')` (runtime form parses as a CallExpression whose
  // callee is the `import` keyword). The type-position form
  // (`typeof import('...')`) is an `ImportTypeNode`, not a CallExpression, so
  // we don't touch it.
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
  literal: import('typescript').StringLiteral,
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
      text: `${quote}${TO_SPECIFIER}${quote}`,
    }
  );
}
