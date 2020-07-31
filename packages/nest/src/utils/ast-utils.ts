import { Tree } from '@angular-devkit/schematics';
import {
  findNodes,
  Change,
  InsertChange,
  getSourceNodes,
} from '@nrwl/workspace/src/utils/ast-utils';
import * as path from 'path';
import * as ts from 'typescript';

export function getExportDeclarations(
  source: ts.SourceFile,
  predicate: (a: any) => boolean
): string[] {
  const allExports = findNodes(source, ts.SyntaxKind.ExportDeclaration);
  const matching = allExports.filter((i: ts.ExportDeclaration) =>
    predicate(i.moduleSpecifier.getText())
  );

  return matching.map((i: ts.ExportDeclaration) => {
    return i.moduleSpecifier
      .getText()
      .substring(1, i.moduleSpecifier.getText().length - 1);
  });
}

export function getExport(
  source: ts.SourceFile,
  predicate: (a: any) => boolean
): { bindings: string[] }[] {
  const allClasses = findNodes(source, ts.SyntaxKind.ClassDeclaration);
  const matching = allClasses.filter((i: ts.ClassDeclaration) => {
    return predicate(i.name.getText());
  });

  return matching.map((i: ts.ClassDeclaration) => {
    return { bindings: [i.name.getText()] };
  });
}

export function getLibraryBarrelExport(host: Tree, config: any): string {
  let barrelPath;
  try {
    barrelPath = path.join(config.sourceRoot, 'index.ts');
  } catch (e) {
    throw new Error('Module barrel cannot be located ' + barrelPath);
  }

  if (!host.exists(barrelPath)) {
    throw new Error('Module barrel cannot be located');
  }

  const barrelSource = host.read(barrelPath)!.toString('utf-8');
  const barrel = ts.createSourceFile(
    barrelPath,
    barrelSource,
    ts.ScriptTarget.Latest,
    true
  );
  const barrelExports = getExportDeclarations(
    barrel,
    (s: string) => s.indexOf('.module') > -1
  );
  if (barrelExports.length !== 1) {
    throw new Error(`${barrelPath} can only export a single module`);
  }
  return barrelExports[0] + '.ts';
}

export function addImportToModule(
  source: ts.SourceFile,
  modulePath: string,
  symbolName: string
): Change[] {
  return _addSymbolToNestModuleMetadata(
    source,
    modulePath,
    'imports',
    symbolName
  );
}

export function addProviderToModule(
  source: ts.SourceFile,
  modulePath: string,
  symbolName: string
): Change[] {
  return _addSymbolToNestModuleMetadata(
    source,
    modulePath,
    'providers',
    symbolName
  );
}

function _nestImportsFromNode(
  node: ts.ImportDeclaration,
  _sourceFile: ts.SourceFile
): { [name: string]: string } {
  const ms = node.moduleSpecifier;
  let modulePath: string;
  switch (ms.kind) {
    case ts.SyntaxKind.StringLiteral:
      modulePath = (ms as ts.StringLiteral).text;
      break;
    default:
      return {};
  }

  if (!modulePath.startsWith('@nestjs/')) {
    return {};
  }

  if (node.importClause) {
    if (node.importClause.name) {
      // This is of the form `import Name from 'path'`. Ignore.
      return {};
    } else if (node.importClause.namedBindings) {
      const nb = node.importClause.namedBindings;
      if (nb.kind == ts.SyntaxKind.NamespaceImport) {
        // This is of the form `import * as name from 'path'`. Return `name.`.
        return {
          [(nb as ts.NamespaceImport).name.text + '.']: modulePath,
        };
      } else {
        // This is of the form `import {a,b,c} from 'path'`
        const namedImports = nb as ts.NamedImports;

        return namedImports.elements
          .map((is: ts.ImportSpecifier) =>
            is.propertyName ? is.propertyName.text : is.name.text
          )
          .reduce((acc: { [name: string]: string }, curr: string) => {
            acc[curr] = modulePath;

            return acc;
          }, {});
      }
    }

    return {};
  } else {
    // This is of the form `import 'path';`. Nothing to do.
    return {};
  }
}

export function getDecoratorMetadata(
  source: ts.SourceFile,
  identifier: string,
  module: string
): ts.Node[] {
  const angularImports: { [name: string]: string } = findNodes(
    source,
    ts.SyntaxKind.ImportDeclaration
  )
    .map((node: ts.ImportDeclaration) => _nestImportsFromNode(node, source))
    .reduce(
      (
        acc: { [name: string]: string },
        current: { [name: string]: string }
      ) => {
        for (const key of Object.keys(current)) {
          acc[key] = current[key];
        }

        return acc;
      },
      {}
    );

  return getSourceNodes(source)
    .filter((node) => {
      return (
        node.kind == ts.SyntaxKind.Decorator &&
        (node as ts.Decorator).expression.kind == ts.SyntaxKind.CallExpression
      );
    })
    .map((node) => (node as ts.Decorator).expression as ts.CallExpression)
    .filter((expr) => {
      if (expr.expression.kind == ts.SyntaxKind.Identifier) {
        const id = expr.expression as ts.Identifier;

        return (
          id.getFullText(source) == identifier &&
          angularImports[id.getFullText(source)] === module
        );
      } else if (
        expr.expression.kind == ts.SyntaxKind.PropertyAccessExpression
      ) {
        // This covers foo.NgModule when importing * as foo.
        const paExpr = expr.expression as ts.PropertyAccessExpression;
        // If the left expression is not an identifier, just give up at that point.
        if (paExpr.expression.kind !== ts.SyntaxKind.Identifier) {
          return false;
        }

        const id = paExpr.name.text;
        const moduleId = (paExpr.expression as ts.Identifier).getText(source);

        return id === identifier && angularImports[moduleId + '.'] === module;
      }

      return false;
    })
    .filter(
      (expr) =>
        expr.arguments[0] &&
        expr.arguments[0].kind == ts.SyntaxKind.ObjectLiteralExpression
    )
    .map((expr) => expr.arguments[0] as ts.ObjectLiteralExpression);
}

function _addSymbolToNestModuleMetadata(
  source: ts.SourceFile,
  ngModulePath: string,
  metadataField: string,
  expression: string
): Change[] {
  const nodes = getDecoratorMetadata(source, 'Module', '@nestjs/common');
  let node: any = nodes[0]; // tslint:disable-line:no-any

  // Find the decorator declaration.
  if (!node) {
    return [];
  }
  // Get all the children property assignment of object literals.
  const matchingProperties: ts.ObjectLiteralElement[] = (node as ts.ObjectLiteralExpression).properties
    .filter((prop) => prop.kind == ts.SyntaxKind.PropertyAssignment)
    // Filter out every fields that's not "metadataField". Also handles string literals
    // (but not expressions).
    .filter((prop: ts.PropertyAssignment) => {
      const name = prop.name;
      switch (name.kind) {
        case ts.SyntaxKind.Identifier:
          return (name as ts.Identifier).getText(source) == metadataField;
        case ts.SyntaxKind.StringLiteral:
          return (name as ts.StringLiteral).text == metadataField;
      }

      return false;
    });

  // Get the last node of the array literal.
  if (!matchingProperties) {
    return [];
  }
  if (matchingProperties.length == 0) {
    // We haven't found the field in the metadata declaration. Insert a new field.
    const expr = node as ts.ObjectLiteralExpression;
    let position: number;
    let toInsert: string;
    if (expr.properties.length == 0) {
      position = expr.getEnd() - 1;
      toInsert = `  ${metadataField}: [${expression}]\n`;
    } else {
      node = expr.properties[expr.properties.length - 1];
      position = node.getEnd();
      // Get the indentation of the last element, if any.
      const text = node.getFullText(source);
      if (text.match('^\r?\r?\n')) {
        toInsert = `,${
          text.match(/^\r?\n\s+/)[0]
        }${metadataField}: [${expression}]`;
      } else {
        toInsert = `, ${metadataField}: [${expression}]`;
      }
    }
    const newMetadataProperty = new InsertChange(
      ngModulePath,
      position,
      toInsert
    );
    return [newMetadataProperty];
  }

  const assignment = matchingProperties[0] as ts.PropertyAssignment;

  // If it's not an array, nothing we can do really.
  if (assignment.initializer.kind !== ts.SyntaxKind.ArrayLiteralExpression) {
    return [];
  }

  const arrLiteral = assignment.initializer as ts.ArrayLiteralExpression;
  if (arrLiteral.elements.length == 0) {
    // Forward the property.
    node = arrLiteral;
  } else {
    node = arrLiteral.elements;
  }

  if (!node) {
    console.log(
      'No app module found. Please add your new class to your component.'
    );

    return [];
  }

  const isArray = Array.isArray(node);
  if (isArray) {
    const nodeArray = (node as {}) as Array<ts.Node>;
    const symbolsArray = nodeArray.map((node) => node.getText());
    if (symbolsArray.includes(expression)) {
      return [];
    }

    node = node[node.length - 1];
  }

  let toInsert: string;
  let position = node.getEnd();
  if (!isArray && node.kind == ts.SyntaxKind.ObjectLiteralExpression) {
    // We haven't found the field in the metadata declaration. Insert a new
    // field.
    const expr = node as ts.ObjectLiteralExpression;
    if (expr.properties.length == 0) {
      position = expr.getEnd() - 1;
      toInsert = `  ${metadataField}: [${expression}]\n`;
    } else {
      node = expr.properties[expr.properties.length - 1];
      position = node.getEnd();
      // Get the indentation of the last element, if any.
      const text = node.getFullText(source);
      if (text.match('^\r?\r?\n')) {
        toInsert = `,${
          text.match(/^\r?\n\s+/)[0]
        }${metadataField}: [${expression}]`;
      } else {
        toInsert = `, ${metadataField}: [${expression}]`;
      }
    }
  } else if (!isArray && node.kind == ts.SyntaxKind.ArrayLiteralExpression) {
    // We found the field but it's empty. Insert it just before the `]`.
    position--;
    toInsert = `${expression}`;
  } else {
    // Get the indentation of the last element, if any.
    const text = node.getFullText(source);
    if (text.match(/^\r?\n/)) {
      toInsert = `,${text.match(/^\r?\n(\r?)\s+/)[0]}${expression}`;
    } else {
      toInsert = `, ${expression}`;
    }
  }
  const insert = new InsertChange(ngModulePath, position, toInsert);
  return [insert];
}
