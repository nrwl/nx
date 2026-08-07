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
 * `bail` abandons the whole file: the config either declares its own
 * `__dirname` (already native-loader safe) or uses it as a shorthand property,
 * where rewriting the value would also rewrite the key. `skip` leaves the one
 * identifier alone; it names a property or an imported binding rather than the
 * CJS global, and `import.meta.dirname` is not legal in those positions.
 */
function classify(node: Node): 'bail' | 'reference' | 'skip' {
  const parent = node.parent;
  if (!parent) {
    return 'reference';
  }
  // The left side of a rename: `{ __dirname: dir }`, `__dirname as dir`.
  // Checked before the binding-name cases below, which share these node kinds.
  if (
    (ts!.isBindingElement(parent) ||
      ts!.isImportSpecifier(parent) ||
      ts!.isExportSpecifier(parent)) &&
    parent.propertyName === node
  ) {
    return 'skip';
  }
  // `foo.__dirname`, `{ __dirname: x }`.
  if (
    (ts!.isPropertyAccessExpression(parent) ||
      ts!.isPropertyAssignment(parent) ||
      ts!.isPropertySignature(parent) ||
      ts!.isMethodDeclaration(parent)) &&
    parent.name === node
  ) {
    return 'skip';
  }
  if (ts!.isShorthandPropertyAssignment(parent)) {
    return 'bail';
  }
  if (
    (ts!.isVariableDeclaration(parent) ||
      ts!.isParameter(parent) ||
      ts!.isBindingElement(parent) ||
      ts!.isFunctionDeclaration(parent) ||
      ts!.isImportSpecifier(parent) ||
      ts!.isImportClause(parent) ||
      ts!.isNamespaceImport(parent) ||
      ts!.isExportSpecifier(parent)) &&
    (parent as { name?: Node }).name === node
  ) {
    return 'bail';
  }
  return 'reference';
}
