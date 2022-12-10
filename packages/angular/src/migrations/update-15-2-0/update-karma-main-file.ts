/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import { chain, Rule, Tree } from '@angular-devkit/schematics';
import * as ts from 'typescript';
import { readWorkspace } from '@schematics/angular/utility';
import { Builders } from '@schematics/angular/utility/workspace-models';
import { allTargetOptions } from '@schematics/angular/utility/workspace';
import { formatFiles } from '@nrwl/workspace';

export default function (): Rule {
  return chain([
    async (host) => {
      for (const file of await findTestMainFiles(host)) {
        updateTestFile(host, file);
      }
    },
    formatFiles(),
  ]);
}

async function findTestMainFiles(host: Tree): Promise<Set<string>> {
  const testFiles = new Set<string>();
  const workspace = await readWorkspace(host);

  // find all test.ts files.
  for (const project of workspace.projects.values()) {
    for (const target of project.targets.values()) {
      if (target.builder !== Builders.Karma) {
        continue;
      }

      for (const [, options] of allTargetOptions(target)) {
        if (typeof options.main === 'string' && host.exists(options.main)) {
          testFiles.add(options.main);
        }
      }
    }
  }

  return testFiles;
}

function updateTestFile(host: Tree, file: string): void {
  const content = host.readText(file);
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
  const recorder = host.beginUpdate(sourceFile.fileName);

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
      recorder.remove(node.getFullStart(), node.getFullWidth());
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
      recorder.remove(node.getFullStart(), node.getFullWidth());
    }
  });

  host.commitUpdate(recorder);
}
