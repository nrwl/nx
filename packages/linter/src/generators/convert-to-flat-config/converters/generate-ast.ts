import * as ts from 'typescript';

/**
 * Generates an AST from a JSON-type input
 */
export function generateAst<T>(input: unknown): T {
  if (Array.isArray(input)) {
    return ts.factory.createArrayLiteralExpression(
      input.map((item) => generateAst<ts.Expression>(item)),
      input.length > 1 // multiline only if more than one item
    ) as T;
  }
  if (input === null) {
    return ts.factory.createNull() as T;
  }
  if (typeof input === 'object') {
    return ts.factory.createObjectLiteralExpression(
      Object.entries(input)
        .filter(([_, value]) => value !== undefined)
        .map(([key, value]) =>
          ts.factory.createPropertyAssignment(
            isValidKey(key) ? key : ts.factory.createStringLiteral(key),
            generateAst<ts.Expression>(value)
          )
        ),
      Object.keys(input).length > 1 // multiline only if more than one property
    ) as T;
  }
  if (typeof input === 'string') {
    return ts.factory.createStringLiteral(input) as T;
  }
  if (typeof input === 'number') {
    return ts.factory.createNumericLiteral(input) as T;
  }
  if (typeof input === 'boolean') {
    return (input ? ts.factory.createTrue() : ts.factory.createFalse()) as T;
  }
  // since we are parsing JSON, this should never happen
  throw new Error(`Unknown type: ${typeof input}`);
}

export function generateRequire(
  variableName: string | ts.ObjectBindingPattern,
  imp: string
): ts.VariableStatement {
  return ts.factory.createVariableStatement(
    undefined,
    ts.factory.createVariableDeclarationList(
      [
        ts.factory.createVariableDeclaration(
          variableName,
          undefined,
          undefined,
          ts.factory.createCallExpression(
            ts.factory.createIdentifier('require'),
            undefined,
            [ts.factory.createStringLiteral(imp)]
          )
        ),
      ],
      ts.NodeFlags.Const
    )
  );
}

function isValidKey(key: string): boolean {
  return /^[a-zA-Z0-9_]+$/.test(key);
}
