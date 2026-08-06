import { joinPathFragments, type Tree } from '@nx/devkit';
import { ESLint } from 'eslint';
import * as ts from 'typescript';

export const JS_ESLINTRC_FILENAMES = ['.eslintrc.js', '.eslintrc.cjs'];

export type StaticJsConfigResult =
  | { kind: 'config'; config: ESLint.ConfigData }
  | { kind: 'unsupported'; reason: string };

export function readStaticJsEslintrcFromTree(
  tree: Tree,
  root: string,
  filename: string
): StaticJsConfigResult {
  const path = joinPathFragments(root, filename);
  const content = tree.read(path, 'utf-8');
  if (content === null) {
    return unsupported('it could not be read');
  }
  return readStaticJsEslintrc(content, path);
}

/**
 * Reads a JavaScript-based eslintrc file (`.eslintrc.js` / `.eslintrc.cjs`)
 * without executing it. Only a single `module.exports = { ... }` assignment
 * whose values are literals is accepted; the resulting plain object feeds the
 * same converter the JSON and YAML configs use. Anything the AST cannot resolve
 * to a literal (a `require`, a template with substitutions, `__dirname`, a
 * conditional) is reported as unsupported so the caller can hand it off instead
 * of guessing at a value.
 */
export function readStaticJsEslintrc(
  content: string,
  filePath: string
): StaticJsConfigResult {
  // TypeScript's parser recovers from syntax errors, so an unterminated object
  // would otherwise read as an empty config and silently replace the user's rules.
  const { diagnostics } = ts.transpileModule(content, {
    fileName: filePath,
    reportDiagnostics: true,
    compilerOptions: { allowJs: true },
  });
  if (diagnostics?.length) {
    return unsupported(
      `it could not be parsed (${ts.flattenDiagnosticMessageText(
        diagnostics[0].messageText,
        ' '
      )})`
    );
  }

  const sourceFile = ts.createSourceFile(
    filePath,
    content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JS
  );

  let exported: ts.Expression | undefined;
  for (const statement of sourceFile.statements) {
    if (isDirective(statement)) {
      continue;
    }
    const assigned = getModuleExportsValue(statement);
    if (!assigned) {
      return unsupported(
        `it contains code other than a single "module.exports" assignment (${describe(
          statement
        )})`
      );
    }
    if (exported) {
      return unsupported('it assigns "module.exports" more than once');
    }
    exported = assigned;
  }

  if (!exported) {
    return unsupported('it does not assign an object to "module.exports"');
  }
  // A JSDoc type cast parenthesizes the object it annotates, so unwrap before
  // deciding whether the export is a literal.
  let exportedValue = exported;
  while (ts.isParenthesizedExpression(exportedValue)) {
    exportedValue = exportedValue.expression;
  }
  if (!ts.isObjectLiteralExpression(exportedValue)) {
    return unsupported(
      `"module.exports" is not an object literal (${describe(exportedValue)})`
    );
  }

  const evaluated = evaluate(exportedValue, '');
  if (evaluated.kind === 'unsupported') {
    return evaluated;
  }

  return {
    kind: 'config',
    config: evaluated.value as ESLint.ConfigData,
  };
}

function isDirective(statement: ts.Statement): boolean {
  return (
    ts.isExpressionStatement(statement) &&
    ts.isStringLiteral(statement.expression)
  );
}

function getModuleExportsValue(
  statement: ts.Statement
): ts.Expression | undefined {
  if (!ts.isExpressionStatement(statement)) {
    return undefined;
  }
  const expression = statement.expression;
  if (
    !ts.isBinaryExpression(expression) ||
    expression.operatorToken.kind !== ts.SyntaxKind.EqualsToken ||
    !ts.isPropertyAccessExpression(expression.left) ||
    !ts.isIdentifier(expression.left.expression) ||
    expression.left.expression.text !== 'module' ||
    expression.left.name.text !== 'exports'
  ) {
    return undefined;
  }
  return expression.right;
}

type EvaluateResult =
  | { kind: 'value'; value: unknown }
  | { kind: 'unsupported'; reason: string };

function evaluate(node: ts.Expression, path: string): EvaluateResult {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return { kind: 'value', value: node.text };
  }
  if (ts.isNumericLiteral(node)) {
    return { kind: 'value', value: Number(node.text) };
  }
  if (node.kind === ts.SyntaxKind.TrueKeyword) {
    return { kind: 'value', value: true };
  }
  if (node.kind === ts.SyntaxKind.FalseKeyword) {
    return { kind: 'value', value: false };
  }
  if (node.kind === ts.SyntaxKind.NullKeyword) {
    return { kind: 'value', value: null };
  }
  if (
    ts.isPrefixUnaryExpression(node) &&
    node.operator === ts.SyntaxKind.MinusToken &&
    ts.isNumericLiteral(node.operand)
  ) {
    return { kind: 'value', value: -Number(node.operand.text) };
  }
  if (ts.isParenthesizedExpression(node)) {
    return evaluate(node.expression, path);
  }
  if (ts.isArrayLiteralExpression(node)) {
    return evaluateArray(node, path);
  }
  if (ts.isObjectLiteralExpression(node)) {
    return evaluateObject(node, path);
  }
  return unsupported(dynamicValueReason(node, path));
}

function evaluateArray(
  node: ts.ArrayLiteralExpression,
  path: string
): EvaluateResult {
  const value: unknown[] = [];
  for (let i = 0; i < node.elements.length; i++) {
    const element = node.elements[i];
    const elementPath = `${path}[${i}]`;
    if (ts.isSpreadElement(element) || ts.isOmittedExpression(element)) {
      return unsupported(dynamicValueReason(element, elementPath));
    }
    const evaluated = evaluate(element, elementPath);
    if (evaluated.kind === 'unsupported') {
      return evaluated;
    }
    value.push(evaluated.value);
  }
  return { kind: 'value', value };
}

function evaluateObject(
  node: ts.ObjectLiteralExpression,
  path: string
): EvaluateResult {
  const value: Record<string, unknown> = {};
  for (const property of node.properties) {
    if (!ts.isPropertyAssignment(property)) {
      return unsupported(dynamicValueReason(property, path));
    }
    const key = getPropertyKey(property.name);
    if (key === undefined) {
      return unsupported(dynamicValueReason(property.name, path));
    }
    const propertyPath = path ? `${path}.${key}` : key;
    const evaluated = evaluate(property.initializer, propertyPath);
    if (evaluated.kind === 'unsupported') {
      return evaluated;
    }
    value[key] = evaluated.value;
  }
  return { kind: 'value', value };
}

function getPropertyKey(name: ts.PropertyName): string | undefined {
  if (
    ts.isIdentifier(name) ||
    ts.isStringLiteral(name) ||
    ts.isNoSubstitutionTemplateLiteral(name) ||
    ts.isNumericLiteral(name)
  ) {
    return name.text;
  }
  return undefined;
}

function dynamicValueReason(node: ts.Node, path: string): string {
  const location = path ? `"${path}"` : 'the exported object';
  return `${location} is not a literal value (${describe(node)})`;
}

// Short, quotable snippet of the offending syntax so the message points at the
// line the reader has to fix rather than at a TypeScript SyntaxKind name.
function describe(node: ts.Node): string {
  const text = node.getText().replace(/\s+/g, ' ').trim();
  return text.length > 60 ? `${text.slice(0, 57)}...` : text;
}

function unsupported(reason: string): { kind: 'unsupported'; reason: string } {
  return { kind: 'unsupported', reason };
}
