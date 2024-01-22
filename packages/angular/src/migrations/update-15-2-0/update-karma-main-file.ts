import type { Tree } from '@nx/devkit';
import { formatFiles } from '@nx/devkit';
import * as ts from 'typescript';
import { Builders } from '@schematics/angular/utility/workspace-models';
import { forEachExecutorOptions } from '@nx/devkit/src/generators/executor-options-utils';
import { FileChangeRecorder } from '../../utils/file-change-recorder';

export default async function (tree: Tree) {
  for (const file of findTestMainFiles(tree)) {
    updateTestFile(tree, file);
  }
  await formatFiles(tree);
}

function findTestMainFiles(tree: Tree): Set<string> {
  const testFiles = new Set<string>();

  // find all test.ts files.
  forEachExecutorOptions<{ main: string | undefined }>(
    tree,
    Builders.Karma,
    (options) => {
      if (typeof options.main === 'string' && tree.exists(options.main)) {
        testFiles.add(options.main);
      }
    }
  );

  return testFiles;
}

function updateTestFile(tree: Tree, file: string): void {
  const content = tree.read(file, 'utf8');
  if (!content.includes('require.context')) {
    return;
  }

  const sourceFile = ts.createSourceFile(
    file,
    content.replace(/^\uFEFF/, ''),
    ts.ScriptTarget.Latest,
    true
  );

  const usedVariableNames = new Set<string>();
  const recorder = new FileChangeRecorder(tree, sourceFile.fileName);

  ts.forEachChild(sourceFile, (node) => {
    if (ts.isVariableStatement(node)) {
      const variableDeclaration = node.declarationList.declarations[0];

      if (
        ts
          .getModifiers(node)
          ?.some((m) => m.kind === ts.SyntaxKind.DeclareKeyword)
      ) {
        // `declare const require`
        if (variableDeclaration.name.getText() !== 'require') {
          return;
        }
      } else {
        // `const context = require.context('./', true, /\.spec\.ts$/);`
        if (
          !variableDeclaration.initializer
            ?.getText()
            .startsWith('require.context')
        ) {
          return;
        }

        // add variable name as used.
        usedVariableNames.add(variableDeclaration.name.getText());
      }

      // Delete node.
      recorder.remove(
        node.getFullStart(),
        node.getFullStart() + node.getFullWidth()
      );
    }

    if (
      usedVariableNames.size &&
      ts.isExpressionStatement(node) && // context.keys().map(context);
      ts.isCallExpression(node.expression) && // context.keys().map(context);
      ts.isPropertyAccessExpression(node.expression.expression) && // context.keys().map
      ts.isCallExpression(node.expression.expression.expression) && // context.keys()
      ts.isPropertyAccessExpression(
        node.expression.expression.expression.expression
      ) && // context.keys
      ts.isIdentifier(
        node.expression.expression.expression.expression.expression
      ) && // context
      usedVariableNames.has(
        node.expression.expression.expression.expression.expression.getText()
      )
    ) {
      // `context.keys().map(context);`
      // `context.keys().forEach(context);`
      recorder.remove(
        node.getFullStart(),
        node.getFullStart() + node.getFullWidth()
      );
    }
  });

  recorder.applyChanges();
}
