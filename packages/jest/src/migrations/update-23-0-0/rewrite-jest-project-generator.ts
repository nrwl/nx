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
import type { Identifier, ImportSpecifier, Node, SourceFile } from 'typescript';

const TS_EXTENSIONS = ['.ts', '.tsx', '.cts', '.mts'] as const;
const PACKAGE = '@nx/jest';
const OLD_NAME = 'jestProjectGenerator';
const NEW_NAME = 'configurationGenerator';

let ts: typeof import('typescript') | undefined;

export default async function rewriteJestProjectGenerator(
  tree: Tree
): Promise<void> {
  let touchedCount = 0;

  visitNotIgnoredFiles(tree, '.', (filePath) => {
    if (!TS_EXTENSIONS.some((ext) => filePath.endsWith(ext))) {
      return;
    }
    const original = tree.read(filePath, 'utf-8');
    if (
      !original ||
      !original.includes(OLD_NAME) ||
      !original.includes(PACKAGE)
    ) {
      return;
    }
    const updated = rewriteJestProjectGeneratorUsage(original);
    if (updated !== original) {
      tree.write(filePath, updated);
      touchedCount += 1;
    }
  });

  if (touchedCount > 0) {
    logger.info(
      `Replaced the deprecated \`${OLD_NAME}\` with \`${NEW_NAME}\` in ${touchedCount} file(s).`
    );
  }

  await formatFiles(tree);
}

export function rewriteJestProjectGeneratorUsage(source: string): string {
  ts ??= ensurePackage<typeof import('typescript')>('typescript', '*');
  const sourceFile = ts.createSourceFile(
    'tmp.ts',
    source,
    ts.ScriptTarget.Latest,
    /* setParentNodes */ true,
    ts.ScriptKind.TSX
  );

  // `jestProjectGenerator as alias` — only the imported name changes.
  let aliasedSpecifier: ImportSpecifier | undefined;
  // `jestProjectGenerator` — the local binding is the old name itself.
  let plainSpecifier: ImportSpecifier | undefined;
  // Whether `configurationGenerator` is already a binding in the file, which
  // means a plain rename would produce a duplicate import specifier.
  let newNameAlreadyBound = false;

  for (const stmt of sourceFile.statements) {
    if (!ts.isImportDeclaration(stmt)) continue;
    if (
      !ts.isStringLiteral(stmt.moduleSpecifier) ||
      stmt.moduleSpecifier.text !== PACKAGE
    ) {
      continue;
    }
    const named = stmt.importClause?.namedBindings;
    if (!named || !ts.isNamedImports(named)) continue;
    for (const spec of named.elements) {
      const importedName = (spec.propertyName ?? spec.name).text;
      if (importedName === OLD_NAME) {
        if (spec.propertyName) {
          aliasedSpecifier = spec;
        } else {
          plainSpecifier = spec;
        }
      }
      if (importedName === NEW_NAME || spec.name.text === NEW_NAME) {
        newNameAlreadyBound = true;
      }
    }
  }

  if (!aliasedSpecifier && !plainSpecifier) {
    return source;
  }

  const changes: StringChange[] = [];

  // `jestProjectGenerator as alias` -> `configurationGenerator as alias`.
  // Call sites use `alias`, so only the imported name is rewritten.
  if (aliasedSpecifier?.propertyName) {
    replaceNode(sourceFile, aliasedSpecifier.propertyName, NEW_NAME, changes);
  }

  if (plainSpecifier) {
    if (newNameAlreadyBound) {
      // A plain rename would collide with the existing `configurationGenerator`
      // binding, so alias the import and leave the call sites untouched.
      replaceNode(
        sourceFile,
        plainSpecifier.name,
        `${NEW_NAME} as ${OLD_NAME}`,
        changes
      );
    } else {
      // Rename the import binding and every bare-identifier usage in the file.
      for (const id of collectBareIdentifiers(sourceFile)) {
        replaceNode(sourceFile, id, NEW_NAME, changes);
      }
    }
  }

  return changes.length > 0 ? applyChangesToString(source, changes) : source;
}

/**
 * Collect every `jestProjectGenerator` identifier that is a standalone
 * reference — the import binding and its call sites — while skipping member
 * accesses like `someObject.jestProjectGenerator`, which are unrelated.
 */
function collectBareIdentifiers(sourceFile: SourceFile): Identifier[] {
  const found: Identifier[] = [];
  const visit = (node: Node): void => {
    if (ts!.isIdentifier(node) && node.text === OLD_NAME) {
      const parent = node.parent;
      const isMemberName =
        parent &&
        ts!.isPropertyAccessExpression(parent) &&
        parent.name === node;
      const isQualifiedName =
        parent && ts!.isQualifiedName(parent) && parent.right === node;
      if (!isMemberName && !isQualifiedName) {
        found.push(node);
      }
    }
    ts!.forEachChild(node, visit);
  };
  visit(sourceFile);
  return found;
}

function replaceNode(
  sourceFile: SourceFile,
  node: Node,
  text: string,
  changes: StringChange[]
): void {
  const start = node.getStart(sourceFile);
  const end = node.getEnd();
  changes.push(
    { type: ChangeType.Delete, start, length: end - start },
    { type: ChangeType.Insert, index: start, text }
  );
}
