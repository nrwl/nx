import * as ts from 'typescript';
import { findNodes, InsertChange, ReplaceChange } from '@nrwl/workspace';
import { Tree } from '@angular-devkit/schematics';
import { stripJsonComments } from '@nrwl/devkit';
import { Config } from '@jest/types';

function createInsertChange(
  path: string,
  value: unknown,
  position: number,
  precedingCommaNeeded: boolean
) {
  return new InsertChange(
    path,
    position,
    `${precedingCommaNeeded ? ',' : ''}${value}`
  );
}

function findPropertyAssignment(
  object: ts.ObjectLiteralExpression,
  propertyName: string
) {
  return object.properties.find((prop) => {
    const propNameText = prop.name.getText();
    if (propNameText.match(/^["'].+["']$/g)) {
      return JSON.parse(propNameText.replace(/'/g, '"')) === propertyName;
    }

    return propNameText === propertyName;
  }) as ts.PropertyAssignment | undefined;
}

export function getJsonObject(object: string) {
  const value = stripJsonComments(object);
  // react babel-jest has __dirname in the config.
  // Put a temp variable in the anon function so that it doesnt fail.
  // Migration script has a catch handler to give instructions on how to update the jest config if this fails.
  return Function(`
  "use strict";
  let __dirname = '';
  return (${value});
 `)();
}

export function addOrUpdateProperty(
  object: ts.ObjectLiteralExpression,
  properties: string[],
  value: unknown,
  path: string
) {
  const propertyName = properties.shift();
  const propertyAssignment = findPropertyAssignment(object, propertyName);

  if (propertyAssignment) {
    if (
      propertyAssignment.initializer.kind === ts.SyntaxKind.StringLiteral ||
      propertyAssignment.initializer.kind === ts.SyntaxKind.NumericLiteral ||
      propertyAssignment.initializer.kind === ts.SyntaxKind.FalseKeyword ||
      propertyAssignment.initializer.kind === ts.SyntaxKind.TrueKeyword
    ) {
      return [
        new ReplaceChange(
          path,
          propertyAssignment.initializer.pos,
          propertyAssignment.initializer.getFullText(),
          value as string
        ),
      ];
    }

    if (
      propertyAssignment.initializer.kind ===
      ts.SyntaxKind.ArrayLiteralExpression
    ) {
      const arrayLiteral =
        propertyAssignment.initializer as ts.ArrayLiteralExpression;

      if (
        arrayLiteral.elements.some((element) => {
          return element.getText().replace(/'/g, '"') === value;
        })
      ) {
        return [];
      }

      if (arrayLiteral.elements.length === 0) {
        return [
          new InsertChange(path, arrayLiteral.elements.end, value as string),
        ];
      } else {
        return [
          createInsertChange(
            path,
            value,
            arrayLiteral.elements.end,
            arrayLiteral.elements.length !== 0 &&
              !arrayLiteral.elements.hasTrailingComma
          ),
        ];
      }
    } else if (
      propertyAssignment.initializer.kind ===
      ts.SyntaxKind.ObjectLiteralExpression
    ) {
      return addOrUpdateProperty(
        propertyAssignment.initializer as ts.ObjectLiteralExpression,
        properties,
        value,
        path
      );
    }
  } else {
    if (propertyName === undefined) {
      throw new Error(
        `Please use dot delimited paths to update an existing object. Eg. object.property `
      );
    }
    return [
      createInsertChange(
        path,
        `${JSON.stringify(propertyName)}: ${value}`,
        object.properties.end,
        object.properties.length !== 0 && !object.properties.hasTrailingComma
      ),
    ];
  }
}

export function removeProperty(
  object: ts.ObjectLiteralExpression,
  properties: string[]
): ts.PropertyAssignment | null {
  const propertyName = properties.shift();
  const propertyAssignment = findPropertyAssignment(object, propertyName);

  if (propertyAssignment) {
    if (
      properties.length > 0 &&
      propertyAssignment.initializer.kind ===
        ts.SyntaxKind.ObjectLiteralExpression
    ) {
      return removeProperty(
        propertyAssignment.initializer as ts.ObjectLiteralExpression,
        properties
      );
    }
    return propertyAssignment;
  } else {
    return null;
  }
}

/**
 * Should be used to get the jest config object.
 *
 * @param host
 * @param path
 */
export function jestConfigObjectAst(
  host: Tree,
  path: string
): ts.ObjectLiteralExpression {
  const fileContent = host.read(path).toString('utf-8');

  const sourceFile = ts.createSourceFile(
    'jest.config.js',
    fileContent,
    ts.ScriptTarget.Latest,
    true
  );

  const expressions = findNodes(
    sourceFile,
    ts.SyntaxKind.BinaryExpression
  ) as ts.BinaryExpression[];

  const moduleExports = expressions.find(
    (node) =>
      node.left.getText() === 'module.exports' &&
      node.operatorToken.kind === ts.SyntaxKind.EqualsToken
  );

  if (!moduleExports) {
    throw new Error(
      `
       The provided jest config file does not have the expected 'module.exports' expression. 
       See https://jestjs.io/docs/en/configuration for more details.`
    );
  }

  if (!ts.isObjectLiteralExpression(moduleExports.right)) {
    throw new Error(
      `The 'module.exports' expression is not an object literal.`
    );
  }

  return moduleExports.right as ts.ObjectLiteralExpression;
}

/**
 * Returns the jest config object
 * @param host
 * @param path
 */
export function jestConfigObject(
  host: Tree,
  path: string
): Partial<Config.InitialOptions> & { [index: string]: any } {
  const jestConfigAst = jestConfigObjectAst(host, path);
  return getJsonObject(jestConfigAst.getText());
}
