import * as ts from 'typescript';

/**
 * Generates an AST from a JSON-type input
 */
export function generateAst<T>(input: unknown, factory: ts.NodeFactory): T {
  if (Array.isArray(input)) {
    return factory.createArrayLiteralExpression(
      input.map((item) => generateAst<ts.Expression>(item, factory)),
      input.length > 1 // multiline only if more than one item
    ) as T;
  }
  if (input === null) {
    return factory.createNull() as T;
  }
  if (typeof input === 'object') {
    return factory.createObjectLiteralExpression(
      Object.entries(input)
        .filter(([_, value]) => value !== undefined)
        .map(([key, value]) =>
          factory.createPropertyAssignment(
            isValidKey(key) ? key : factory.createStringLiteral(key),
            generateAst<ts.Expression>(value, factory)
          )
        ),
      Object.keys(input).length > 1 // multiline only if more than one property
    ) as T;
  }
  if (typeof input === 'string') {
    return factory.createStringLiteral(input) as T;
  }
  if (typeof input === 'number') {
    return factory.createNumericLiteral(input) as T;
  }
  if (typeof input === 'boolean') {
    return (input ? factory.createTrue() : factory.createFalse()) as T;
  }
  // since we are parsing JSON, this should never happen
  throw new Error(`Unknown type: ${typeof input}`);
}

function isValidKey(key: string): boolean {
  return /^[a-zA-Z0-9_]+$/.test(key);
}
