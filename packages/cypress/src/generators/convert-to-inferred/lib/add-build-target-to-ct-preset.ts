import type { Tree } from '@nx/devkit';
import { ensureTypescript } from '@nx/js/internal';
import { query } from '@phenomnomnominal/tsquery';
import type { CallExpression, PropertyName } from 'typescript';
import { getPropertyName, parseSourceFile } from '../../../utils/migrations';

let ts: typeof import('typescript');

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
  const presetCall = query<CallExpression>(
    parseSourceFile(configFilePath, contents),
    'CallExpression'
  ).find(
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
  // The factory parenthesizes the left operand when precedence requires it
  const needsParentheses = ts.isParenthesizedExpression(
    ts.factory.createBinaryExpression(
      value,
      ts.SyntaxKind.BarBarToken,
      ts.factory.createStringLiteral(buildTarget)
    ).left
  );
  const valueText = value.getText();
  replace(
    value.getStart(),
    value.getEnd(),
    `${needsParentheses ? `(${valueText})` : valueText} || ${buildTargetLiteral}`
  );
  return true;
}

function isUnresolvedComputedName(name: PropertyName): boolean {
  return ts.isComputedPropertyName(name) && getPropertyName(name) === null;
}
