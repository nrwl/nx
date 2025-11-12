import { formatFiles, visitNotIgnoredFiles, type Tree } from '@nx/devkit';
import { ensureTypescript } from '@nx/js/src/utils/typescript/ensure-typescript';
import { tsquery } from '@phenomnomnominal/tsquery';
import type { CallExpression, Printer, PropertyName } from 'typescript';
import { cypressProjectConfigs } from '../../utils/migrations.js';

let printer: Printer;
let ts: typeof import('typescript');

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
  printer ??= ts.createPrinter();

  const sourceFile = tsquery.ast(updated);
  let hasChanges = false;

  const result = tsquery.replace(
    updated,
    'CallExpression:has(Identifier[name="defaults"])',
    (node: CallExpression) => {
      if (!ts.isPropertyAccessExpression(node.expression)) {
        return node.getText();
      }

      if (node.expression.name.getText() !== 'defaults') {
        return node.getText();
      }

      const selectorExpr = node.expression.expression;
      if (!ts.isPropertyAccessExpression(selectorExpr)) {
        return node.getText();
      }

      if (!ts.isIdentifier(selectorExpr.expression)) {
        return node.getText();
      }

      if (selectorExpr.expression.text !== 'Cypress') {
        return node.getText();
      }

      const selectorName = selectorExpr.name.getText();
      if (
        selectorName !== 'ElementSelector' &&
        selectorName !== 'SelectorPlayground'
      ) {
        return node.getText();
      }

      if (!node.arguments.length) {
        return node.getText();
      }

      const [firstArg, ...restArgs] = node.arguments;
      if (!ts.isObjectLiteralExpression(firstArg)) {
        return node.getText();
      }

      const filteredProperties = firstArg.properties.filter((prop) => {
        if (
          ts.isPropertyAssignment(prop) ||
          ts.isShorthandPropertyAssignment(prop) ||
          ts.isMethodDeclaration(prop) ||
          ts.isGetAccessorDeclaration(prop) ||
          ts.isSetAccessorDeclaration(prop)
        ) {
          return !isOnElementProperty(prop.name);
        }

        return true;
      });

      if (filteredProperties.length === firstArg.properties.length) {
        return node.getText();
      }

      hasChanges = true;

      const updatedObjectLiteral = ts.factory.updateObjectLiteralExpression(
        firstArg,
        filteredProperties
      );

      const updatedCall = ts.factory.updateCallExpression(
        node,
        node.expression,
        node.typeArguments,
        [updatedObjectLiteral, ...restArgs]
      );

      return printer.printNode(
        ts.EmitHint.Unspecified,
        updatedCall,
        sourceFile
      );
    }
  );

  return hasChanges ? result : updated;
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
