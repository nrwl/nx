import { ensureTypescript, type TypescriptAst } from '@nx/devkit/internal';
import type {
  Expression,
  PropertyAssignment,
  SourceFile,
  StringLiteral,
} from 'typescript';

let ts: TypescriptAst;

export function toPropertyAssignment(
  key: string,
  value: unknown
): PropertyAssignment {
  ts ??= ensureTypescript();
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

export function toPropertyName(key: string): string | StringLiteral {
  ts ??= ensureTypescript();
  return /^[A-Za-z_$][\w$]*$/.test(key)
    ? key
    : ts.factory.createStringLiteral(key);
}

export function toExpression(value: unknown): Expression {
  ts ??= ensureTypescript();
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
  sourceFile: SourceFile,
  key: string
): boolean {
  ts ??= ensureTypescript();
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
