import type { Tree } from '@nx/devkit';
import {
  ensureTypescript,
  tsquery,
  type TypescriptAst,
} from '@nx/devkit/internal';
import type { CallExpression, Expression, PropertyName } from 'typescript';
import { getPropertyName, parseSourceFile } from '../../../utils/migrations';

let ts: TypescriptAst;

/**
 * Sets `buildTarget` in the `nxComponentTestingPreset` options. A non-empty
 * string literal is kept and any other value gets an `||` fallback. Returns
 * false when there is no such call or the value can't be resolved statically.
 */
export function addBuildTargetToComponentTestingPreset(
  tree: Tree,
  configFilePath: string,
  buildTarget: string
): boolean {
  ts ??= ensureTypescript();

  const contents = tree.read(configFilePath, 'utf-8');
  if (contents === null) {
    return false;
  }
  const presetCall = tsquery
    .query<CallExpression>(
      parseSourceFile(configFilePath, contents),
      'CallExpression'
    )
    .find(
      (call) =>
        ts.isIdentifier(call.expression) &&
        call.expression.text === 'nxComponentTestingPreset'
    );
  const [pathToConfig, options] = presetCall?.arguments ?? [];
  if (!pathToConfig) {
    return false;
  }

  const replace = (start: number, end: number, text: string) =>
    tree.write(
      configFilePath,
      `${contents.slice(0, start)}${text}${contents.slice(end)}`
    );
  const buildTargetLiteral = JSON.stringify(buildTarget);

  if (!options) {
    const insertAt = pathToConfig.getEnd();
    replace(insertAt, insertAt, `, { buildTarget: ${buildTargetLiteral} }`);
    return true;
  }
  if (!ts.isObjectLiteralExpression(options)) {
    return false;
  }

  const effectiveProperty = [...options.properties]
    .reverse()
    .find(
      (property) =>
        ts.isSpreadAssignment(property) ||
        isUnresolvedComputedName(property.name) ||
        getPropertyName(property.name) === 'buildTarget'
    );
  if (!effectiveProperty) {
    // `__proto__: value` sets the prototype, which can provide buildTarget
    if (
      options.properties.some(
        (property) =>
          ts.isPropertyAssignment(property) &&
          !ts.isComputedPropertyName(property.name) &&
          getPropertyName(property.name) === '__proto__'
      )
    ) {
      return false;
    }
    const insertAt = options.getStart() + 1;
    replace(insertAt, insertAt, ` buildTarget: ${buildTargetLiteral},`);
    return true;
  }
  if (ts.isShorthandPropertyAssignment(effectiveProperty)) {
    replace(
      effectiveProperty.getStart(),
      effectiveProperty.getEnd(),
      `buildTarget: buildTarget || ${buildTargetLiteral}`
    );
    return true;
  }
  if (
    !ts.isPropertyAssignment(effectiveProperty) ||
    isUnresolvedComputedName(effectiveProperty.name)
  ) {
    return false;
  }

  const value = effectiveProperty.initializer;
  if (ts.isStringLiteralLike(value) && value.text) {
    return true;
  }
  const valueText = value.getText();
  replace(
    value.getStart(),
    value.getEnd(),
    `${needsParentheses(configFilePath, value) ? `(${valueText})` : valueText} || ${buildTargetLiteral}`
  );
  return true;
}

function needsParentheses(filePath: string, value: Expression): boolean {
  // `a ?? b || c` is a syntax error that still parses as `(a ?? b) || c`
  if (
    ts.isBinaryExpression(value) &&
    value.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken
  ) {
    return true;
  }
  const valueText = value.getText();
  const [statement] = parseSourceFile(
    filePath,
    `(${valueText} || '')`
  ).statements;
  const expression =
    ts.isExpressionStatement(statement) &&
    ts.isParenthesizedExpression(statement.expression)
      ? statement.expression.expression
      : undefined;
  return !(
    expression &&
    ts.isBinaryExpression(expression) &&
    expression.operatorToken.kind === ts.SyntaxKind.BarBarToken &&
    expression.left.getText() === valueText
  );
}

function isUnresolvedComputedName(name: PropertyName): boolean {
  return ts.isComputedPropertyName(name) && getPropertyName(name) === null;
}
