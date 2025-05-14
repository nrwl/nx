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
