import { formatFiles, visitNotIgnoredFiles, type Tree } from '@nx/devkit';
import { ensureTypescript } from '@nx/js/src/utils/typescript/ensure-typescript';
import { tsquery } from '@phenomnomnominal/tsquery';
import type { CallExpression } from 'typescript';
import { cypressProjectConfigs } from '../../utils/migrations.js';

let ts: typeof import('typescript');

export default async function renameCyExecCodeProperty(tree: Tree) {
  for await (const { projectConfig } of cypressProjectConfigs(tree)) {
    visitNotIgnoredFiles(tree, projectConfig.root, (filePath) => {
      if (!isJsTsFile(filePath) || !tree.exists(filePath)) {
        return;
      }

      const originalContent = tree.read(filePath, 'utf-8');
      const updatedContent = updateCyExecItsCalls(originalContent);

      if (updatedContent !== originalContent) {
        tree.write(filePath, updatedContent);
      }
    });
  }

  await formatFiles(tree);
}

function updateCyExecItsCalls(fileContent: string): string {
  // quick check to avoid parsing the file if it doesn't contain the string
  if (
    !fileContent.includes("its('code')") &&
    !fileContent.includes('its("code")') &&
    !fileContent.includes('its(`code`)')
  ) {
    return fileContent;
  }

  ts ??= ensureTypescript();
  const sourceFile = tsquery.ast(fileContent);
  const updates: Array<{ start: number; end: number; text: string }> = [];

  const callExpressions = tsquery.query<CallExpression>(
    sourceFile,
    'CallExpression:has(PropertyAccessExpression > Identifier[name="its"])'
  );

  for (const callExpression of callExpressions) {
    if (!shouldUpdateCallExpression(callExpression)) {
      continue;
    }

    const firstArg = callExpression.arguments[0];
    const literalText = firstArg.getText(sourceFile);
    const quote = literalText[0];
    const replacementText = `${quote}exitCode${quote}`;

    updates.push({
      start: firstArg.getStart(sourceFile),
      end: firstArg.getEnd(),
      text: replacementText,
    });
  }

  if (!updates.length) {
    return fileContent;
  }

  let updatedContent = fileContent;
  for (const update of updates.sort((a, b) => b.start - a.start)) {
    updatedContent =
      updatedContent.slice(0, update.start) +
      update.text +
      updatedContent.slice(update.end);
  }

  return updatedContent;
}

function shouldUpdateCallExpression(node: CallExpression): boolean {
  if (!node.arguments.length) {
    return false;
  }

  ts ??= ensureTypescript();

  const firstArg = node.arguments[0];
  if (
    !(
      ts.isStringLiteral(firstArg) ||
      ts.isNoSubstitutionTemplateLiteral(firstArg)
    ) ||
    firstArg.text !== 'code'
  ) {
    return false;
  }

  if (!ts.isPropertyAccessExpression(node.expression)) {
    return false;
  }

  if (node.expression.name.getText() !== 'its') {
    return false;
  }

  return isDerivedFromCyExec(node.expression.expression);
}

function isDerivedFromCyExec(
  expression: import('typescript').Expression
): boolean {
  ts ??= ensureTypescript();

  if (ts.isCallExpression(expression)) {
    return isDerivedFromCyExec(expression.expression);
  }

  if (ts.isPropertyAccessExpression(expression)) {
    if (
      expression.name.getText() === 'exec' &&
      ts.isIdentifier(expression.expression) &&
      expression.expression.text === 'cy'
    ) {
      return true;
    }

    return isDerivedFromCyExec(expression.expression);
  }

  return false;
}

function isJsTsFile(filePath: string): boolean {
  return /\.[cm]?[jt]sx?$/.test(filePath);
}
