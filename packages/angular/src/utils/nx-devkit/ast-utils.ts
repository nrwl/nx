import * as ts from 'typescript';
import { findNodes } from '@nrwl/workspace/src/utilities/typescript/find-nodes';
import { getSourceNodes } from '@nrwl/workspace/src/utilities/typescript/get-source-nodes';
import * as path from 'path';
import { Tree, names, readProjectConfiguration } from '@nrwl/devkit';
import {
  insertChange,
  removeChange,
  getImport,
} from '@nrwl/workspace/src/utilities/ast-utils';

function _angularImportsFromNode(
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

  if (!modulePath.startsWith('@angular/')) {
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
          [`${(nb as ts.NamespaceImport).name.text}.`]: modulePath,
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
    .map((node: ts.ImportDeclaration) => _angularImportsFromNode(node, source))
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

        return id === identifier && angularImports[`${moduleId}.`] === module;
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

function _addSymbolToNgModuleMetadata(
  host: Tree,
  source: ts.SourceFile,
  ngModulePath: string,
  metadataField: string,
  expression: string
): ts.SourceFile {
  const nodes = getDecoratorMetadata(source, 'NgModule', '@angular/core');
  let node: any = nodes[0]; // tslint:disable-line:no-any

  // Find the decorator declaration.
  if (!node) {
    return source;
  }
  // Get all the children property assignment of object literals.
  const matchingProperties: ts.ObjectLiteralElement[] = (
    node as ts.ObjectLiteralExpression
  ).properties
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
    return source;
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

    return insertChange(host, source, ngModulePath, position, toInsert);
  }

  const assignment = matchingProperties[0] as ts.PropertyAssignment;

  // If it's not an array, nothing we can do really.
  if (assignment.initializer.kind !== ts.SyntaxKind.ArrayLiteralExpression) {
    return source;
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

    return source;
  }

  const isArray = Array.isArray(node);
  if (isArray) {
    const nodeArray = node as {} as Array<ts.Node>;
    const symbolsArray = nodeArray.map((node) => node.getText());
    if (symbolsArray.includes(expression)) {
      return source;
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
  return insertChange(host, source, ngModulePath, position, toInsert);
}

export function removeFromNgModule(
  host: Tree,
  source: ts.SourceFile,
  modulePath: string,
  property: string
): ts.SourceFile {
  const nodes = getDecoratorMetadata(source, 'NgModule', '@angular/core');
  let node: any = nodes[0]; // tslint:disable-line:no-any

  // Find the decorator declaration.
  if (!node) {
    return source;
  }

  // Get all the children property assignment of object literals.
  const matchingProperty = getMatchingProperty(
    source,
    property,
    'NgModule',
    '@angular/core'
  );
  if (matchingProperty) {
    return removeChange(
      host,
      source,
      modulePath,
      matchingProperty.getStart(source),
      matchingProperty.getFullText(source)
    );
  }
}

export function addImportToModule(
  host: Tree,
  source: ts.SourceFile,
  modulePath: string,
  symbolName: string
): ts.SourceFile {
  return _addSymbolToNgModuleMetadata(
    host,
    source,
    modulePath,
    'imports',
    symbolName
  );
}

export function addImportToTestBed(
  host: Tree,
  source: ts.SourceFile,
  specPath: string,
  symbolName: string
): ts.SourceFile {
  const allCalls: ts.CallExpression[] = <any>(
    findNodes(source, ts.SyntaxKind.CallExpression)
  );

  const configureTestingModuleObjectLiterals = allCalls
    .filter((c) => c.expression.kind === ts.SyntaxKind.PropertyAccessExpression)
    .filter(
      (c: any) => c.expression.name.getText(source) === 'configureTestingModule'
    )
    .map((c) =>
      c.arguments[0].kind === ts.SyntaxKind.ObjectLiteralExpression
        ? c.arguments[0]
        : null
    );

  if (configureTestingModuleObjectLiterals.length > 0) {
    const startPosition = configureTestingModuleObjectLiterals[0]
      .getFirstToken(source)
      .getEnd();
    return insertChange(
      host,
      source,
      specPath,
      startPosition,
      `imports: [${symbolName}], `
    );
  }
  return source;
}

export function getBootstrapComponent(
  source: ts.SourceFile,
  moduleClassName: string
): string {
  const bootstrap = getMatchingProperty(
    source,
    'bootstrap',
    'NgModule',
    '@angular/core'
  );
  if (!bootstrap) {
    throw new Error(`Cannot find bootstrap components in '${moduleClassName}'`);
  }
  const c = bootstrap.getChildren();
  const nodes = c[c.length - 1].getChildren();

  const bootstrapComponent = nodes.slice(1, nodes.length - 1)[0];
  if (!bootstrapComponent) {
    throw new Error(`Cannot find bootstrap components in '${moduleClassName}'`);
  }

  return bootstrapComponent.getText();
}

function getMatchingProperty(
  source: ts.SourceFile,
  property: string,
  identifier: string,
  module: string
): ts.ObjectLiteralElement {
  const nodes = getDecoratorMetadata(source, identifier, module);
  let node: any = nodes[0]; // tslint:disable-line:no-any

  if (!node) return null;

  // Get all the children property assignment of object literals.
  return getMatchingObjectLiteralElement(node, source, property);
}

export function addRoute(
  host: Tree,
  ngModulePath: string,
  source: ts.SourceFile,
  route: string
): ts.SourceFile {
  const routes = getListOfRoutes(source);
  if (!routes) return source;

  if (routes.hasTrailingComma || routes.length === 0) {
    return insertChange(host, source, ngModulePath, routes.end, route);
  } else {
    return insertChange(host, source, ngModulePath, routes.end, `, ${route}`);
  }
}

function getListOfRoutes(
  source: ts.SourceFile
): ts.NodeArray<ts.Expression> | null {
  const imports: any = getMatchingProperty(
    source,
    'imports',
    'NgModule',
    '@angular/core'
  );

  if (imports?.initializer.kind === ts.SyntaxKind.ArrayLiteralExpression) {
    const a = imports.initializer as ts.ArrayLiteralExpression;

    for (const e of a.elements) {
      if (e.kind === ts.SyntaxKind.CallExpression) {
        const ee = e as ts.CallExpression;
        const text = ee.expression.getText(source);
        if (
          (text === 'RouterModule.forRoot' ||
            text === 'RouterModule.forChild') &&
          ee.arguments.length > 0
        ) {
          const routes = ee.arguments[0];
          if (routes.kind === ts.SyntaxKind.ArrayLiteralExpression) {
            return (routes as ts.ArrayLiteralExpression).elements;
          } else if (routes.kind === ts.SyntaxKind.Identifier) {
            // find the array expression
            const variableDeclarations = findNodes(
              source,
              ts.SyntaxKind.VariableDeclaration
            ) as ts.VariableDeclaration[];

            const routesDeclaration = variableDeclarations.find((x) => {
              return x.name.getText() === routes.getText();
            });

            if (routesDeclaration) {
              return (
                routesDeclaration.initializer as ts.ArrayLiteralExpression
              ).elements;
            }
          }
        }
      }
    }
  }
  return null;
}

export function addProviderToModule(
  host: Tree,
  source: ts.SourceFile,
  modulePath: string,
  symbolName: string
): ts.SourceFile {
  return _addSymbolToNgModuleMetadata(
    host,
    source,
    modulePath,
    'providers',
    symbolName
  );
}

export function addDeclarationToModule(
  host: Tree,
  source: ts.SourceFile,
  modulePath: string,
  symbolName: string
): ts.SourceFile {
  return _addSymbolToNgModuleMetadata(
    host,
    source,
    modulePath,
    'declarations',
    symbolName
  );
}

export function addEntryComponents(
  host: Tree,
  source: ts.SourceFile,
  modulePath: string,
  symbolName: string
): ts.SourceFile {
  return _addSymbolToNgModuleMetadata(
    host,
    source,
    modulePath,
    'entryComponents',
    symbolName
  );
}

export function readBootstrapInfo(
  host: Tree,
  app: string
): {
  moduleSpec: string;
  modulePath: string;
  mainPath: string;
  moduleClassName: string;
  moduleSource: ts.SourceFile;
  bootstrapComponentClassName: string;
  bootstrapComponentFileName: string;
} {
  const config = readProjectConfiguration(host, app);

  let mainPath;
  try {
    mainPath = config.targets.build.options.main;
  } catch (e) {
    throw new Error('Main file cannot be located');
  }

  if (!host.exists(mainPath)) {
    throw new Error('Main file cannot be located');
  }

  const mainSource = host.read(mainPath)!.toString('utf-8');
  const main = ts.createSourceFile(
    mainPath,
    mainSource,
    ts.ScriptTarget.Latest,
    true
  );
  const moduleImports = getImport(
    main,
    (s: string) => s.indexOf('.module') > -1
  );
  if (moduleImports.length !== 1) {
    throw new Error(`main.ts can only import a single module`);
  }
  const moduleImport = moduleImports[0];
  const moduleClassName = moduleImport.bindings.filter((b) =>
    b.endsWith('Module')
  )[0];

  const modulePath = `${path.join(
    path.dirname(mainPath),
    moduleImport.moduleSpec
  )}.ts`;
  if (!host.exists(modulePath)) {
    throw new Error(`Cannot find '${modulePath}'`);
  }

  const moduleSourceText = host.read(modulePath)!.toString('utf-8');
  const moduleSource = ts.createSourceFile(
    modulePath,
    moduleSourceText,
    ts.ScriptTarget.Latest,
    true
  );

  const bootstrapComponentClassName = getBootstrapComponent(
    moduleSource,
    moduleClassName
  );
  const bootstrapComponentFileName = `./${path.join(
    path.dirname(moduleImport.moduleSpec),
    `${
      names(
        bootstrapComponentClassName.substring(
          0,
          bootstrapComponentClassName.length - 9
        )
      ).fileName
    }.component`
  )}`;

  return {
    moduleSpec: moduleImport.moduleSpec,
    mainPath,
    modulePath,
    moduleSource,
    moduleClassName,
    bootstrapComponentClassName,
    bootstrapComponentFileName,
  };
}

export function getDecoratorPropertyValueNode(
  host: Tree,
  modulePath: string,
  identifier: string,
  property: string,
  module: string
) {
  const moduleSourceText = host.read(modulePath)!.toString('utf-8');
  const moduleSource = ts.createSourceFile(
    modulePath,
    moduleSourceText,
    ts.ScriptTarget.Latest,
    true
  );
  const templateNode = getMatchingProperty(
    moduleSource,
    property,
    identifier,
    module
  );

  return templateNode.getChildAt(templateNode.getChildCount() - 1);
}

function getMatchingObjectLiteralElement(
  node: any,
  source: ts.SourceFile,
  property: string
) {
  return (
    (node as ts.ObjectLiteralExpression).properties
      .filter((prop) => prop.kind == ts.SyntaxKind.PropertyAssignment)
      // Filter out every fields that's not "metadataField". Also handles string literals
      // (but not expressions).
      .filter((prop: ts.PropertyAssignment) => {
        const name = prop.name;
        switch (name.kind) {
          case ts.SyntaxKind.Identifier:
            return (name as ts.Identifier).getText(source) === property;
          case ts.SyntaxKind.StringLiteral:
            return (name as ts.StringLiteral).text === property;
        }
        return false;
      })[0]
  );
}

export function getTsSourceFile(host: Tree, path: string): ts.SourceFile {
  const buffer = host.read(path);
  if (!buffer) {
    throw new Error(`Could not read TS file (${path}).`);
  }
  const content = buffer.toString();
  const source = ts.createSourceFile(
    path,
    content,
    ts.ScriptTarget.Latest,
    true
  );

  return source;
}
