import * as ts from 'typescript';

export function toPropertyAssignment(
  key: string,
  value: unknown
): ts.PropertyAssignment {
  if (typeof value === 'string') {
    return ts.factory.createPropertyAssignment(
      ts.factory.createStringLiteral(key),
      ts.factory.createStringLiteral(value)
    );
  } else if (typeof value === 'number') {
    return ts.factory.createPropertyAssignment(
      ts.factory.createStringLiteral(key),
      ts.factory.createNumericLiteral(value)
    );
  } else if (typeof value === 'boolean') {
    return ts.factory.createPropertyAssignment(
      ts.factory.createStringLiteral(key),
      value ? ts.factory.createTrue() : ts.factory.createFalse()
    );
  } else if (Array.isArray(value)) {
    return ts.factory.createPropertyAssignment(
      ts.factory.createStringLiteral(key),
      ts.factory.createArrayLiteralExpression(
        value.map((item) => toExpression(item))
      )
    );
  } else {
    return ts.factory.createPropertyAssignment(
      ts.factory.createStringLiteral(key),
      ts.factory.createObjectLiteralExpression(
        Object.entries(value).map(([key, value]) =>
          toPropertyAssignment(key, value)
        )
      )
    );
  }
}

export function toExpression(value: unknown): ts.Expression {
  if (typeof value === 'string') {
    return ts.factory.createStringLiteral(value);
  } else if (typeof value === 'number') {
    return ts.factory.createNumericLiteral(value);
  } else if (typeof value === 'boolean') {
    return value ? ts.factory.createTrue() : ts.factory.createFalse();
  } else if (Array.isArray(value)) {
    return ts.factory.createArrayLiteralExpression(
      value.map((item) => toExpression(item))
    );
  } else {
    return ts.factory.createObjectLiteralExpression(
      Object.entries(value).map(([key, value]) =>
        toPropertyAssignment(key, value)
      )
    );
  }
}

/** Whether a top-level `configValues` object written by convert-to-inferred has `key`. */
export function hasMigratedConfigValues(
  sourceFile: ts.SourceFile,
  key: string
): boolean {
  return sourceFile.statements.some(
    (statement) =>
      ts.isVariableStatement(statement) &&
      statement.declarationList.declarations.some(
        (declaration) =>
          ts.isIdentifier(declaration.name) &&
          declaration.name.text === 'configValues' &&
          declaration.initializer !== undefined &&
          ts.isObjectLiteralExpression(declaration.initializer) &&
          declaration.initializer.properties.some(
            (property) =>
              ts.isPropertyAssignment(property) &&
              (ts.isIdentifier(property.name) ||
                ts.isStringLiteral(property.name)) &&
              property.name.text === key
          )
      )
  );
}
