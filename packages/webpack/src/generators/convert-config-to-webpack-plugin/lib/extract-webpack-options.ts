import { Tree } from '@nx/devkit';
import { tsquery } from '@phenomnomnominal/tsquery';
import * as ts from 'typescript';

export function extractWebpackOptions(tree: Tree, webpackConfigPath: string) {
  const source = tree.read(webpackConfigPath).toString('utf-8');
  const ast = tsquery.ast(source);

  const withNxQuery = 'CallExpression:has(Identifier[name="withNx"])';
  const withReactQuery = 'CallExpression:has(Identifier[name="withReact"])';
  const withWebQuery = 'CallExpression:has(Identifier[name="withWeb"])';

  const withNxCall = tsquery(ast, withNxQuery) as ts.CallExpression[];

  const withReactCall = tsquery(ast, withReactQuery) as ts.CallExpression[];

  const withWebCall = tsquery(ast, withWebQuery) as ts.CallExpression[];

  // If the config is empty set to empty string to avoid undefined. Undefined is used to check if the withNx exists inside of the config file.
  let withNxConfig: ts.Node | '' | undefined,
    withReactConfig: ts.Node | '' | undefined;

  withWebCall.forEach((node) => {
    const argument = node.arguments[0] || '';
    withNxConfig = argument; // Since withWeb and withNx use the same config object and both should not exist in the same file, we can reuse the withNxConfig variable.
  });

  withNxCall.forEach((node) => {
    const argument = node.arguments[0] || ''; // The first argument is the config object
    withNxConfig = argument;
  });

  withReactCall.forEach((node) => {
    const argument = node.arguments[0] || '';
    withReactConfig = argument;
  });

  if (withNxConfig !== undefined) {
    // Only remove the withNx and withReact calls if they exist
    let updatedSource = removeCallExpressions(source, [
      'withNx',
      'withReact',
      'withWeb',
    ]);
    updatedSource = removeImportDeclarations(
      updatedSource,
      'withNx',
      '@nx/webpack'
    );
    updatedSource = removeImportDeclarations(
      updatedSource,
      'withWeb',
      '@nx/webpack'
    );
    updatedSource = removeImportDeclarations(
      updatedSource,
      'withReact',
      '@nx/react'
    );

    tree.write(webpackConfigPath, updatedSource);
  }

  return { withNxConfig, withReactConfig };
}

function removeCallExpressions(
  source: string,
  functionNames: string[]
): string {
  let modifiedSource = source;
  functionNames.forEach((functionName) => {
    const callExpressionQuery = `CallExpression:has(Identifier[name="composePlugins"]) > CallExpression:has(Identifier[name="${functionName}"])`;

    modifiedSource = tsquery.replace(
      modifiedSource,
      callExpressionQuery,
      () => {
        return ''; // Removes the entire CallExpression
      }
    );
  });

  return modifiedSource;
}

function removeImportDeclarations(
  source: string,
  importName: string,
  moduleName: string
) {
  const sourceFile = tsquery.ast(source);

  const modifiedStatements = sourceFile.statements
    .map((statement) => {
      if (!ts.isVariableStatement(statement)) return statement;

      const declarationList = statement.declarationList;
      const newDeclarations = declarationList.declarations
        .map((declaration) => {
          if (
            !ts.isVariableDeclaration(declaration) ||
            !declaration.initializer
          )
            return declaration;

          if (
            ts.isCallExpression(declaration.initializer) &&
            ts.isIdentifier(declaration.initializer.expression)
          ) {
            const callExpr = declaration.initializer.expression;
            if (
              callExpr.text === 'require' &&
              declaration.initializer.arguments[0]
                ?.getText()
                .replace(/['"]/g, '') === moduleName
            ) {
              if (ts.isObjectBindingPattern(declaration.name)) {
                const bindingElements = declaration.name.elements.filter(
                  (element) => {
                    const elementName = element.name.getText();
                    return elementName !== importName;
                  }
                );

                if (bindingElements.length > 0) {
                  const newBindingPattern =
                    ts.factory.updateObjectBindingPattern(
                      declaration.name,
                      bindingElements
                    );

                  // Update the variable declaration with the new binding pattern without the specified import name
                  return ts.factory.updateVariableDeclaration(
                    declaration,
                    newBindingPattern,
                    declaration.exclamationToken,
                    declaration.type,
                    declaration.initializer
                  );
                } else {
                  return null; // Remove this declaration entirely if no bindings remain
                }
              }
            }
          }
          return declaration;
        })
        .filter(Boolean);

      if (newDeclarations.length > 0) {
        const newDeclarationList = ts.factory.updateVariableDeclarationList(
          declarationList,
          newDeclarations as ts.VariableDeclaration[]
        );
        return ts.factory.updateVariableStatement(
          statement,
          statement.modifiers,
          newDeclarationList
        );
      } else {
        return null; // Remove the entire statement
      }
    })
    .filter(Boolean);

  // Use printer to format the source code and rewrite the modified
  const newSourceFile = ts.factory.updateSourceFile(
    sourceFile,
    modifiedStatements as ts.Statement[]
  );
  const printer = ts.createPrinter();
  const formattedSource = printer.printFile(newSourceFile);

  return formattedSource;
}
