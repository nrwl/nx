// go through the jest.config files
// see if it imports from @nx/jest and if it uses getJestProjects
// replace getJestProjects with getJestProjectsAsync

import { globAsync, Tree } from '@nx/devkit';
import { ensureTypescript } from '@nx/js/src/utils/typescript/ensure-typescript';
import {
  BinaryExpression,
  ExpressionStatement,
  ExportAssignment,
} from 'typescript';

let tsModule: typeof import('typescript');

export default async function update(tree: Tree) {
  if (!tsModule) {
    tsModule = ensureTypescript();
  }

  const jestConfigPaths = await globAsync(tree, [
    '**/jest.config.{cjs,mjs,js,cts,mts,ts}',
  ]);
  jestConfigPaths.forEach((jestConfigPath) => {
    const oldContent = tree.read(jestConfigPath).toString();
    if (oldContent?.includes('projects: getJestProjects()')) {
      let sourceFile = tsModule.createSourceFile(
        jestConfigPath,
        oldContent,
        tsModule.ScriptTarget.Latest,
        true
      );

      // find `require('@nx/jest')` or `import { getJestProjects } from '@nx/jest`
      const requireStatement = sourceFile.statements.find(
        (statement) =>
          tsModule.isVariableStatement(statement) &&
          statement.declarationList.declarations.some(
            (declaration) =>
              tsModule.isCallExpression(declaration.initializer) &&
              tsModule.isIdentifier(declaration.initializer.expression) &&
              declaration.initializer.expression.escapedText === 'require' &&
              tsModule.isStringLiteral(declaration.initializer.arguments[0]) &&
              declaration.initializer.arguments[0].text === '@nx/jest'
          )
      );
      const importStatement = sourceFile.statements.find(
        (statement) =>
          tsModule.isImportDeclaration(statement) &&
          statement.moduleSpecifier.getText() === `'@nx/jest'`
      );
      if (requireStatement || importStatement) {
        // find `module.exports` statement with `projects: getJestProjects()`
        const moduleExports = sourceFile.statements.find(
          (statement) =>
            tsModule.isExpressionStatement(statement) &&
            tsModule.isBinaryExpression(statement.expression) &&
            tsModule.isPropertyAccessExpression(statement.expression.left) &&
            tsModule.isObjectLiteralExpression(statement.expression.right) &&
            statement.expression.operatorToken.kind ===
              tsModule.SyntaxKind.EqualsToken &&
            tsModule.isIdentifier(statement.expression.left.expression) &&
            statement.expression.left.expression.escapedText === 'module' &&
            tsModule.isIdentifier(statement.expression.left.name) &&
            statement.expression.left.name.escapedText === 'exports' &&
            statement.expression.right.properties.some(
              (property) =>
                tsModule.isPropertyAssignment(property) &&
                tsModule.isIdentifier(property.name) &&
                property.name.escapedText === 'projects' &&
                tsModule.isCallExpression(property.initializer) &&
                tsModule.isIdentifier(property.initializer.expression) &&
                property.initializer.expression.escapedText ===
                  'getJestProjects'
            )
        ) as ExpressionStatement;

        if (moduleExports) {
          // replace getJestProjects with getJestProjectsAsync in export statement
          const rightExpression = (
            moduleExports.expression as BinaryExpression
          ).right.getText();
          const newExpression = rightExpression.replace(
            'getJestProjects()',
            'await getJestProjectsAsync()'
          );
          const newStatement = `module.exports = async () => (${newExpression});`;
          let newContent = oldContent.replace(
            moduleExports.getText(),
            newStatement
          );

          // replace getJestProjects with getJestProjectsAsync in import statement
          newContent = newContent.replace(
            'getJestProjects',
            'getJestProjectsAsync'
          );

          tree.write(jestConfigPath, newContent);
        } else {
          // find `export default` statement with `projects: getJestProjects()`
          const exportAssignment = sourceFile.statements.find((statement) =>
            tsModule.isExportAssignment(statement)
          ) as ExportAssignment;
          const defaultExport =
            exportAssignment?.expression &&
            tsModule.isObjectLiteralExpression(exportAssignment?.expression)
              ? exportAssignment?.expression
              : null;
          const projectProperty = defaultExport?.properties.find(
            (property) =>
              tsModule.isPropertyAssignment(property) &&
              property.name.getText() === 'projects' &&
              tsModule.isCallExpression(property.initializer) &&
              tsModule.isIdentifier(property.initializer.expression) &&
              property.initializer.expression.escapedText === 'getJestProjects'
          );
          if (projectProperty) {
            // replace getJestProjects with getJestProjectsAsync in export statement
            const newExpression = defaultExport
              .getText()
              .replace('getJestProjects()', 'await getJestProjectsAsync()');
            const newStatement = `export default async () => (${newExpression});`;
            let newContent = oldContent.replace(
              exportAssignment.getText(),
              newStatement
            );

            // replace getJestProjects with getJestProjectsAsync in import statement
            newContent = newContent.replace(
              'getJestProjects',
              'getJestProjectsAsync'
            );

            tree.write(jestConfigPath, newContent);
          }
        }
      }
    }
  });
}
