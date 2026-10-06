import {
  ensurePackage,
  formatFiles,
  logger,
  type Tree,
  visitNotIgnoredFiles,
} from '@nx/devkit';
import type { Node } from 'typescript';

// Only ESM-only extensions. A `.ts`/`.js` config can still be loaded as CJS,
// where `import.meta` is a syntax error.
const CONFIG_FILE_PATTERN = /(^|\/)(vite|vitest)\.config\.(mts|mjs)$/;

let ts: typeof import('typescript') | undefined;

export default async function useImportMetaDirname(tree: Tree): Promise<void> {
  let touchedCount = 0;

  visitNotIgnoredFiles(tree, '.', (filePath) => {
    if (!CONFIG_FILE_PATTERN.test(filePath)) {
      return;
    }
    const original = tree.read(filePath, 'utf-8');
    if (!original?.includes('__dirname')) {
      return;
    }
    const updated = rewriteDirname(original);
    if (updated !== original) {
      tree.write(filePath, updated);
      touchedCount += 1;
    }
  });

  if (touchedCount > 0) {
    logger.info(
      `Replaced \`__dirname\` with \`import.meta.dirname\` in ${touchedCount} Vite config file(s).`
    );
  }

  await formatFiles(tree);
}

export function rewriteDirname(source: string): string {
  ts ??= ensurePackage<typeof import('typescript')>('typescript', '*');
  const sourceFile = ts.createSourceFile(
    'tmp.mts',
    source,
    ts.ScriptTarget.Latest,
    /* setParentNodes */ true,
    ts.ScriptKind.TS
  );

  // A config TypeScript can only error-recover on may not mean what its AST
  // says, so leave it for a human rather than rewrite it blind.
  if (
    (sourceFile as { parseDiagnostics?: unknown[] }).parseDiagnostics?.length
  ) {
    return source;
  }

  const references: Node[] = [];
  let bailOut = false;

  const visit = (node: Node): void => {
    if (ts!.isIdentifier(node) && node.text === '__dirname') {
      const kind = classify(node);
      if (kind === 'bail') {
        bailOut = true;
      } else if (kind === 'reference') {
        references.push(node);
      }
    }
    ts!.forEachChild(node, visit);
  };
  visit(sourceFile);

  if (bailOut || references.length === 0) {
    return source;
  }

  let updated = source;
  for (const node of references.reverse()) {
    const start = node.getStart(sourceFile);
    updated =
      updated.slice(0, start) +
      'import.meta.dirname' +
      updated.slice(node.getEnd());
  }

  return updated;
}

/**
 * `bail` abandons the whole file: something binds `__dirname` in scope, so the
 * identifier no longer means the CJS global, or it is a shorthand property
 * where key and value are one token. `skip` leaves a single identifier alone.
 *
 * The name-position test is inverted on purpose - anything sitting in a
 * parent's `name` or `propertyName` slot is excluded by default, so node kinds
 * nobody enumerated (class fields, accessors, enum members) cannot be rewritten
 * into invalid syntax.
 */
function classify(node: Node): 'bail' | 'reference' | 'skip' {
  const parent = node.parent as
    | (Node & { name?: Node; propertyName?: Node })
    | undefined;
  if (!parent) {
    return 'reference';
  }
  if (ts!.isShorthandPropertyAssignment(parent)) {
    return 'bail';
  }
  if (bindsDirname(parent, node)) {
    return 'bail';
  }
  if (parent.name === node || parent.propertyName === node) {
    return 'skip';
  }
  return 'reference';
}

/** Declarations that put a new `__dirname` in scope, shadowing the global. */
function bindsDirname(parent: Node & { name?: Node }, node: Node): boolean {
  if (parent.name !== node) {
    return false;
  }
  return (
    ts!.isVariableDeclaration(parent) ||
    ts!.isParameter(parent) ||
    ts!.isBindingElement(parent) ||
    ts!.isFunctionDeclaration(parent) ||
    ts!.isClassDeclaration(parent) ||
    ts!.isImportClause(parent) ||
    ts!.isImportSpecifier(parent) ||
    ts!.isNamespaceImport(parent) ||
    ts!.isExportSpecifier(parent)
  );
}
