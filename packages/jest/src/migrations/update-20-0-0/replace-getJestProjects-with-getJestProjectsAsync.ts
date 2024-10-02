// go through the jest.config files
// see if it imports from @nx/jest and if it uses getJestProjects
// replace getJestProjects with getJestProjectsAsync

import { globAsync, Tree } from '@nx/devkit';
import { ensureTypescript } from '@nx/js/src/utils/typescript/ensure-typescript';
import { BinaryExpression, ExpressionStatement } from 'typescript';

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

      // find the import statement for @nx/jest
      const importStatement = sourceFile.statements.find(
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
      if (importStatement) {
        // find export statement with `projects: getJestProjects()`
        let exportStatement = sourceFile.statements.find(
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

        if (exportStatement) {
          // replace getJestProjects with getJestProjectsAsync in export statement
          const rightExpression = (
            exportStatement.expression as BinaryExpression
          ).right.getText();
          const newExpression = rightExpression.replace(
            'getJestProjects()',
            'await getJestProjectsAsync()'
          );
          const newStatement = `export default async () => (${newExpression});`;
          let newContent = oldContent.replace(
            exportStatement.getText(),
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
  });
}
