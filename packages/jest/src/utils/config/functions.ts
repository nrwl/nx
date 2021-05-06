import * as ts from 'typescript';
import {
  BinaryExpression,
  ExpressionStatement,
  isBinaryExpression,
  isExpressionStatement,
  SyntaxKind,
} from 'typescript';
import { applyChangesToString, ChangeType, Tree } from '@nrwl/devkit';
import * as stripJsonComments from 'strip-json-comments';
import { Config } from '@jest/types';

function makeTextToInsert(
  value: unknown,
  precedingCommaNeeded: boolean
): string {
  return `${precedingCommaNeeded ? ',' : ''}${value}`;
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
  tree: Tree,
  object: ts.ObjectLiteralExpression,
  properties: string[],
  value: unknown,
  path: string
) {
  const propertyName = properties.shift();
  const propertyAssignment = findPropertyAssignment(object, propertyName);

  const originalContents = tree.read(path).toString();

  if (propertyAssignment) {
    if (
      propertyAssignment.initializer.kind === ts.SyntaxKind.StringLiteral ||
      propertyAssignment.initializer.kind === ts.SyntaxKind.NumericLiteral ||
      propertyAssignment.initializer.kind === ts.SyntaxKind.FalseKeyword ||
      propertyAssignment.initializer.kind === ts.SyntaxKind.TrueKeyword
    ) {
      const updatedContents = applyChangesToString(originalContents, [
        {
          type: ChangeType.Delete,
          start: propertyAssignment.initializer.pos,
          length: propertyAssignment.initializer.getFullText().length,
        },
        {
          type: ChangeType.Insert,
          index: propertyAssignment.initializer.pos,
          text: value as string,
        },
      ]);

      tree.write(path, updatedContents);
      return;
    }

    if (
      propertyAssignment.initializer.kind ===
      ts.SyntaxKind.ArrayLiteralExpression
    ) {
      const arrayLiteral = propertyAssignment.initializer as ts.ArrayLiteralExpression;

      if (
        arrayLiteral.elements.some((element) => {
          return element.getText().replace(/'/g, '"') === value;
        })
      ) {
        return [];
      }

      if (arrayLiteral.elements.length === 0) {
        const updatedContents = applyChangesToString(originalContents, [
          {
            type: ChangeType.Insert,
            index: arrayLiteral.elements.end,
            text: value as string,
          },
        ]);
        tree.write(path, updatedContents);
        return;
      } else {
        const text = makeTextToInsert(
          value,
          arrayLiteral.elements.length !== 0 &&
            !arrayLiteral.elements.hasTrailingComma
        );
        const updatedContents = applyChangesToString(originalContents, [
          {
            type: ChangeType.Insert,
            index: arrayLiteral.elements.end,
            text,
          },
        ]);
        tree.write(path, updatedContents);
        return;
      }
    } else if (
      propertyAssignment.initializer.kind ===
      ts.SyntaxKind.ObjectLiteralExpression
    ) {
      return addOrUpdateProperty(
        tree,
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
    const text = makeTextToInsert(
      `${JSON.stringify(propertyName)}: ${value}`,
      object.properties.length !== 0 && !object.properties.hasTrailingComma
    );
    const updatedContents = applyChangesToString(originalContents, [
      {
        type: ChangeType.Insert,
        index: object.properties.end,
        text,
      },
    ]);
    tree.write(path, updatedContents);
    return;
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
  fileContent: string
): ts.ObjectLiteralExpression {
  const sourceFile = ts.createSourceFile(
    'jest.config.js',
    fileContent,
    ts.ScriptTarget.Latest,
    true
  );

  const moduleExportsStatement = sourceFile.statements.find(
    (statement) =>
      isExpressionStatement(statement) &&
      isBinaryExpression(statement.expression) &&
      statement.expression.left.getText() === 'module.exports' &&
      statement.expression.operatorToken.kind === SyntaxKind.EqualsToken
  );

  const moduleExports = (moduleExportsStatement as ExpressionStatement)
    .expression as BinaryExpression;

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
  const jestConfigAst = jestConfigObjectAst(host.read(path).toString('utf-8'));
  return getJsonObject(jestConfigAst.getText());
}
