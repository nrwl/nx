import * as ts from 'typescript';
import {
  BinaryExpression,
  ExpressionStatement,
  isBinaryExpression,
  isExpressionStatement,
  isPropertyAssignment,
  SyntaxKind,
} from 'typescript';
import { applyChangesToString, ChangeType, Tree } from '@nrwl/devkit';
import { Config } from '@jest/types';
import { createContext, runInContext } from 'vm';
import { dirname, join } from 'path';

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
    if (!isPropertyAssignment(prop)) {
      return false;
    }
    const propNameText = prop.name.getText();
    if (propNameText.match(/^["'].+["']$/g)) {
      return JSON.parse(propNameText.replace(/'/g, '"')) === propertyName;
    }

    return propNameText === propertyName;
  }) as ts.PropertyAssignment | undefined;
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

  const originalContents = tree.read(path, 'utf-8');

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
    'jest.config.ts',
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
  const __filename = join(host.root, path);
  const contents = host.read(path, 'utf-8');
  let module = { exports: {} };

  // Run the contents of the file with some stuff from this current context
  // The module.exports will be mutated by the contents of the file...
  runInContext(
    contents,
    createContext({
      module,
      require,
      process,
      __filename,
      __dirname: dirname(__filename),
    })
  );

  // TODO: jest actually allows defining configs with async functions... we should be able to read that...
  return module.exports;
}
