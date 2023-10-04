import type * as ts from 'typescript';
import { applyChangesToString, ChangeType, Tree } from '@nx/devkit';
import { Config } from '@jest/types';
import { createContext, runInContext } from 'vm';
import { dirname, join } from 'path';
import { ensureTypescript } from '@nx/js/src/utils/typescript/ensure-typescript';

let tsModule: typeof import('typescript');

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
  if (!tsModule) {
    tsModule = ensureTypescript();
  }

  return object.properties.find((prop) => {
    if (!tsModule.isPropertyAssignment(prop)) {
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
  if (!tsModule) {
    tsModule = ensureTypescript();
  }
  const { SyntaxKind } = tsModule;

  const propertyName = properties.shift();
  const propertyAssignment = findPropertyAssignment(object, propertyName);

  const originalContents = tree.read(path, 'utf-8');

  if (propertyAssignment) {
    if (
      propertyAssignment.initializer.kind === SyntaxKind.StringLiteral ||
      propertyAssignment.initializer.kind === SyntaxKind.NumericLiteral ||
      propertyAssignment.initializer.kind === SyntaxKind.FalseKeyword ||
      propertyAssignment.initializer.kind === SyntaxKind.TrueKeyword
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
      propertyAssignment.initializer.kind === SyntaxKind.ArrayLiteralExpression
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
      propertyAssignment.initializer.kind === SyntaxKind.ObjectLiteralExpression
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
  if (!tsModule) {
    tsModule = ensureTypescript();
  }

  const propertyName = properties.shift();
  const propertyAssignment = findPropertyAssignment(object, propertyName);

  if (propertyAssignment) {
    if (
      properties.length > 0 &&
      propertyAssignment.initializer.kind ===
        tsModule.SyntaxKind.ObjectLiteralExpression
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

function isModuleExport(node: ts.Statement) {
  if (!tsModule) {
    tsModule = ensureTypescript();
  }

  return (
    tsModule.isExpressionStatement(node) &&
    node.expression?.kind &&
    tsModule.isBinaryExpression(node.expression) &&
    node.expression.left.getText() === 'module.exports' &&
    node.expression.operatorToken?.kind === tsModule.SyntaxKind.EqualsToken
  );
}

function isDefaultExport(node: ts.Statement) {
  if (!tsModule) {
    tsModule = ensureTypescript();
  }

  return (
    tsModule.isExportAssignment(node) &&
    node.expression?.kind &&
    tsModule.isObjectLiteralExpression(node.expression) &&
    node.getText().startsWith('export default')
  );
}

/**
 * Should be used to get the jest config object as AST
 */
export function jestConfigObjectAst(
  fileContent: string
): ts.ObjectLiteralExpression {
  if (!tsModule) {
    tsModule = ensureTypescript();
  }

  const sourceFile = tsModule.createSourceFile(
    'jest.config.ts',
    fileContent,
    tsModule.ScriptTarget.Latest,
    true
  );

  const exportStatement = sourceFile.statements.find(
    (statement) => isModuleExport(statement) || isDefaultExport(statement)
  );

  let ast: ts.ObjectLiteralExpression;
  if (tsModule.isExpressionStatement(exportStatement)) {
    const moduleExports = exportStatement.expression as ts.BinaryExpression;
    if (!moduleExports) {
      throw new Error(
        `
       The provided jest config file does not have the expected 'module.exports' expression. 
       See https://jestjs.io/docs/en/configuration for more details.`
      );
    }

    ast = moduleExports.right as ts.ObjectLiteralExpression;
  } else if (tsModule.isExportAssignment(exportStatement)) {
    const defaultExport =
      exportStatement.expression as ts.ObjectLiteralExpression;

    if (!defaultExport) {
      throw new Error(
        `
       The provided jest config file does not have the expected 'export default' expression. 
       See https://jestjs.io/docs/en/configuration for more details.`
      );
    }

    ast = defaultExport;
  }
  if (!ast) {
    throw new Error(
      `
      The provided jest config file does not have the expected 'module.exports' or 'export default' expression. 
      See https://jestjs.io/docs/en/configuration for more details.`
    );
  }

  if (!tsModule.isObjectLiteralExpression(ast)) {
    throw new Error(
      `The 'export default' or 'module.exports' expression is not an object literal.`
    );
  }

  return ast;
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

  // transform the export default syntax to module.exports
  // this will work for the default config, but will break if there are any other ts syntax
  // TODO(caleb): use the AST to transform back to the module.exports syntax so this will keep working
  //  or deprecate and make a new method for getting the jest config object
  const forcedModuleSyntax = contents.replace(
    /export\s+default/,
    'module.exports ='
  );
  // Run the contents of the file with some stuff from this current context
  // The module.exports will be mutated by the contents of the file...
  runInContext(
    forcedModuleSyntax,
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
