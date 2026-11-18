import type { Tree } from '@nx/devkit';
import { ensureTypescript } from '@nx/js/internal';
import type * as ts from 'typescript';
import { getTsSourceFile } from '../../../utils/nx-devkit/ast-utils';

const REQUEST_HANDLER_FACTORIES: Record<string, string> = {
  '@angular/ssr/node': 'createNodeRequestHandler',
  '@angular/ssr': 'createRequestHandler',
};

/**
 * Whether the file's `reqHandler` export is the return value of Angular's
 * `createNodeRequestHandler` or `createRequestHandler`. Shapes the file alone
 * can't prove, such as a re-export from another file, return false.
 */
export function exportsAngularRequestHandler(
  tree: Tree,
  path: string
): boolean {
  if (!tree.exists(path)) {
    return false;
  }
  const tsModule = ensureTypescript();
  const source = getTsSourceFile(tree, path);

  const factories = new Set<string>();
  const namespaces = new Map<string, string>();
  const constInitializers = new Map<string, ts.Expression>();
  let exportedName: string | undefined;

  for (const statement of source.statements) {
    if (
      tsModule.isImportDeclaration(statement) &&
      tsModule.isStringLiteral(statement.moduleSpecifier)
    ) {
      const factory = REQUEST_HANDLER_FACTORIES[statement.moduleSpecifier.text];
      const bindings = statement.importClause?.namedBindings;
      if (!factory || !bindings || statement.importClause.isTypeOnly) {
        continue;
      }
      if (tsModule.isNamespaceImport(bindings)) {
        namespaces.set(bindings.name.text, factory);
        continue;
      }
      for (const element of bindings.elements) {
        if (
          !element.isTypeOnly &&
          (element.propertyName ?? element.name).text === factory
        ) {
          factories.add(element.name.text);
        }
      }
    } else if (
      tsModule.isVariableStatement(statement) &&
      (statement.declarationList.flags & tsModule.NodeFlags.BlockScoped) ===
        tsModule.NodeFlags.Const
    ) {
      const isExported = statement.modifiers?.some(
        (modifier) => modifier.kind === tsModule.SyntaxKind.ExportKeyword
      );
      for (const declaration of statement.declarationList.declarations) {
        if (
          !tsModule.isIdentifier(declaration.name) ||
          !declaration.initializer
        ) {
          continue;
        }
        constInitializers.set(declaration.name.text, declaration.initializer);
        if (isExported && declaration.name.text === 'reqHandler') {
          exportedName = 'reqHandler';
        }
      }
    } else if (
      tsModule.isExportDeclaration(statement) &&
      !statement.moduleSpecifier &&
      !statement.isTypeOnly &&
      statement.exportClause &&
      tsModule.isNamedExports(statement.exportClause)
    ) {
      for (const element of statement.exportClause.elements) {
        if (!element.isTypeOnly && element.name.text === 'reqHandler') {
          exportedName = (element.propertyName ?? element.name).text;
        }
      }
    }
  }

  let initializer = exportedName
    ? constInitializers.get(exportedName)
    : undefined;
  while (
    initializer &&
    (tsModule.isParenthesizedExpression(initializer) ||
      tsModule.isAsExpression(initializer) ||
      tsModule.isSatisfiesExpression(initializer) ||
      tsModule.isNonNullExpression(initializer) ||
      tsModule.isTypeAssertionExpression(initializer))
  ) {
    initializer = initializer.expression;
  }
  if (!initializer || !tsModule.isCallExpression(initializer)) {
    return false;
  }
  const callee = initializer.expression;
  if (tsModule.isIdentifier(callee)) {
    return factories.has(callee.text);
  }
  return (
    tsModule.isPropertyAccessExpression(callee) &&
    tsModule.isIdentifier(callee.expression) &&
    namespaces.get(callee.expression.text) === callee.name.text
  );
}
