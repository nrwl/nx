import {
  applyChangesToString,
  formatFiles,
  visitNotIgnoredFiles,
  type Tree,
} from '@nx/devkit';
import {
  ensureTypescript,
  tsquery,
  type TypescriptAst,
} from '@nx/devkit/internal';
import type { CallExpression, PropertyName } from 'typescript';
import { cypressProjectConfigs, removeProperty } from '../../utils/migrations';

let ts: TypescriptAst;

export default async function updateSelectorPlaygroundApi(tree: Tree) {
  for await (const { projectConfig } of cypressProjectConfigs(tree)) {
    visitNotIgnoredFiles(tree, projectConfig.root, (filePath) => {
      if (!isJsTsFile(filePath) || !tree.exists(filePath)) {
        return;
      }

      const originalContent = tree.read(filePath, 'utf-8');
      const updatedContent = migrateSelectorPlaygroundApi(originalContent);

      if (updatedContent !== originalContent) {
        tree.write(filePath, updatedContent);
      }
    });
  }

  await formatFiles(tree);
}

function migrateSelectorPlaygroundApi(fileContent: string): string {
  let updated = fileContent;

  if (updated.includes('Cypress.SelectorPlayground')) {
    updated = updated.replace(
      /Cypress\.SelectorPlayground/g,
      'Cypress.ElementSelector'
    );
  }

  if (
    !updated.includes('Cypress.ElementSelector') &&
    !updated.includes('Cypress.SelectorPlayground')
  ) {
    return updated;
  }

  ts ??= ensureTypescript();

  const changes = tsquery
    .query<CallExpression>(
      updated,
      'CallExpression:has(Identifier[name="defaults"])'
    )
    .flatMap((node) => {
      if (!ts.isPropertyAccessExpression(node.expression)) {
        return [];
      }

      if (node.expression.name.getText() !== 'defaults') {
        return [];
      }

      const selectorExpr = node.expression.expression;
      if (!ts.isPropertyAccessExpression(selectorExpr)) {
        return [];
      }

      if (!ts.isIdentifier(selectorExpr.expression)) {
        return [];
      }

      if (selectorExpr.expression.text !== 'Cypress') {
        return [];
      }

      const selectorName = selectorExpr.name.getText();
      if (
        selectorName !== 'ElementSelector' &&
        selectorName !== 'SelectorPlayground'
      ) {
        return [];
      }

      if (!node.arguments.length) {
        return [];
      }

      const [firstArg] = node.arguments;
      if (!ts.isObjectLiteralExpression(firstArg)) {
        return [];
      }

      return firstArg.properties
        .filter(
          (prop) =>
            (ts.isPropertyAssignment(prop) ||
              ts.isShorthandPropertyAssignment(prop) ||
              ts.isMethodDeclaration(prop) ||
              ts.isGetAccessorDeclaration(prop) ||
              ts.isSetAccessorDeclaration(prop)) &&
            isOnElementProperty(prop.name)
        )
        .flatMap((prop) => removeProperty(updated, prop));
    });

  return applyChangesToString(updated, changes);
}

function isOnElementProperty(name: PropertyName): boolean {
  ts ??= ensureTypescript();

  if (ts.isIdentifier(name)) {
    return name.text === 'onElement';
  }

  if (ts.isStringLiteralLike(name)) {
    return name.text === 'onElement';
  }

  return false;
}

function isJsTsFile(filePath: string): boolean {
  return /\.[cm]?[jt]sx?$/.test(filePath);
}
