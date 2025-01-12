import { names, readProjectConfiguration, Tree } from '@nx/devkit';
import {
  findNodes,
  getImport,
  getSourceNodes,
  insertChange,
  removeChange,
  replaceChange,
} from '@nx/js';
import { ensureTypescript } from '@nx/js/src/utils/typescript/ensure-typescript';
import { dirname, join } from 'path';
import type * as ts from 'typescript';
import { getInstalledAngularVersionInfo } from '../../executors/utilities/angular-version-utils';
import { getInstalledAngularVersionInfo as getInstalledAngularVersionInfoFromTree } from '../../generators/utils/version-utils';

let tsModule: typeof import('typescript');

type DecoratorName = 'Component' | 'Directive' | 'NgModule' | 'Pipe';

function _angularImportsFromNode(
  node: ts.ImportDeclaration,
  _sourceFile: ts.SourceFile
): { [name: string]: string } {
  if (!tsModule) {
    tsModule = ensureTypescript();
  }
  const ms = node.moduleSpecifier;
  let modulePath: string;
  switch (ms.kind) {
    case tsModule.SyntaxKind.StringLiteral:
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
      if (nb.kind == tsModule.SyntaxKind.NamespaceImport) {
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

/**
 * Check if the Component, Directive or Pipe is standalone
 * @param sourceFile TS Source File containing the token to check
 * @param decoratorName The type of decorator to check (Component, Directive, Pipe)
 *
 * @deprecated Use the function signature with a Tree. This signature will be removed in v21.
 */
export function isStandalone(
  sourceFile: ts.SourceFile,
  decoratorName: DecoratorName
): boolean;
/**
 * Check if the Component, Directive or Pipe is standalone
 * @param tree The file system tree
 * @param sourceFile TS Source File containing the token to check
 * @param decoratorName The type of decorator to check (Component, Directive, Pipe)
 */
export function isStandalone(
  tree: Tree,
  sourceFile: ts.SourceFile,
  decoratorName: DecoratorName
): boolean;
export function isStandalone(
  treeOrSourceFile: Tree | ts.SourceFile,
  sourceFileOrDecoratorName: ts.SourceFile | DecoratorName,
  decoratorName?: DecoratorName
): boolean {
  let tree: Tree;
  let sourceFile: ts.SourceFile;
  if (decoratorName === undefined) {
    sourceFile = treeOrSourceFile as ts.SourceFile;
    decoratorName = sourceFileOrDecoratorName as DecoratorName;
  } else {
    tree = treeOrSourceFile as Tree;
    sourceFile = sourceFileOrDecoratorName as ts.SourceFile;
    decoratorName = decoratorName as DecoratorName;
  }

  const decoratorMetadata = getDecoratorMetadata(
    sourceFile,
    decoratorName,
    '@angular/core'
  );
  const hasStandaloneTrue = decoratorMetadata.some((node) =>
    node.getText().includes('standalone: true')
  );

  if (hasStandaloneTrue) {
    return true;
  }

  const { major: angularMajorVersion } = tree
    ? getInstalledAngularVersionInfoFromTree(tree)
    : getInstalledAngularVersionInfo();
  if (angularMajorVersion !== null && angularMajorVersion < 19) {
    // in angular 18 and below, standalone: false is the default, so, if
    // standalone: true is not set, then it is false
    return false;
  }

  // in case angularMajorVersion is null, we assume that the version is 19 or
  // above, in which case, standalone: true is the default, so we need to
  // check that standalone: false is not set
  return !decoratorMetadata.some((node) =>
    node.getText().includes('standalone: false')
  );
}

export function getDecoratorMetadata(
  source: ts.SourceFile,
  identifier: string,
  module: string
): ts.Node[] {
  if (!tsModule) {
    tsModule = ensureTypescript();
  }
  const angularImports: { [name: string]: string } = findNodes(
    source,
    tsModule.SyntaxKind.ImportDeclaration
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
        node.kind == tsModule.SyntaxKind.Decorator &&
        (node as ts.Decorator).expression.kind ==
          tsModule.SyntaxKind.CallExpression
      );
    })
    .map((node) => (node as ts.Decorator).expression as ts.CallExpression)
    .filter((expr) => {
      if (expr.expression.kind == tsModule.SyntaxKind.Identifier) {
        const id = expr.expression as ts.Identifier;

        return (
          id.getFullText(source) == identifier &&
          angularImports[id.getFullText(source)] === module
        );
      } else if (
        expr.expression.kind == tsModule.SyntaxKind.PropertyAccessExpression
      ) {
        // This covers foo.NgModule when importing * as foo.
        const paExpr = expr.expression as ts.PropertyAccessExpression;
        // If the left expression is not an identifier, just give up at that point.
        if (paExpr.expression.kind !== tsModule.SyntaxKind.Identifier) {
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
        expr.arguments[0].kind == tsModule.SyntaxKind.ObjectLiteralExpression
    )
    .map((expr) => expr.arguments[0] as ts.ObjectLiteralExpression);
}

function _addSymbolToDecoratorMetadata(
  host: Tree,
  source: ts.SourceFile,
  filePath: string,
  metadataField: string,
  expression: string,
  decoratorName: DecoratorName
): ts.SourceFile {
  const nodes = getDecoratorMetadata(source, decoratorName, '@angular/core');
  let node: any = nodes[0];

  // Find the decorator declaration.
  if (!node) {
    return source;
  }
  if (!tsModule) {
    tsModule = ensureTypescript();
  }
  // Get all the children property assignment of object literals.
  const matchingProperties: ts.ObjectLiteralElement[] = (
    node as ts.ObjectLiteralExpression
  ).properties
    .filter((prop) => prop.kind == tsModule.SyntaxKind.PropertyAssignment)
    // Filter out every fields that's not "metadataField". Also handles string literals
    // (but not expressions).
    .filter((prop: ts.PropertyAssignment) => {
      const name = prop.name;
      switch (name.kind) {
        case tsModule.SyntaxKind.Identifier:
          return (name as ts.Identifier).getText(source) == metadataField;
        case tsModule.SyntaxKind.StringLiteral:
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

    return insertChange(host, source, filePath, position, toInsert);
  }

  const assignment = matchingProperties[0] as ts.PropertyAssignment;

  // If it's not an array, nothing we can do really.
  if (
    assignment.initializer.kind !== tsModule.SyntaxKind.ArrayLiteralExpression
  ) {
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
  if (!isArray && node.kind == tsModule.SyntaxKind.ObjectLiteralExpression) {
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
  } else if (
    !isArray &&
    node.kind == tsModule.SyntaxKind.ArrayLiteralExpression
  ) {
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
  return insertChange(host, source, filePath, position, toInsert);
}

function _addSymbolToNgModuleMetadata(
  host: Tree,
  source: ts.SourceFile,
  ngModulePath: string,
  metadataField: string,
  expression: string
): ts.SourceFile {
  return _addSymbolToDecoratorMetadata(
    host,
    source,
    ngModulePath,
    metadataField,
    expression,
    'NgModule'
  );
}

export function removeFromNgModule(
  host: Tree,
  source: ts.SourceFile,
  modulePath: string,
  property: string
): ts.SourceFile {
  const nodes = getDecoratorMetadata(source, 'NgModule', '@angular/core');
  let node: any = nodes[0];

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

/**
 * Add an import to a Standalone Component
 * @param host Virtual Tree
 * @param source TS Source File containing the Component
 * @param componentPath The path to the Component
 * @param symbolName The import to add to the Component
 */
export function addImportToComponent(
  host: Tree,
  source: ts.SourceFile,
  componentPath: string,
  symbolName: string
): ts.SourceFile {
  return _addSymbolToDecoratorMetadata(
    host,
    source,
    componentPath,
    'imports',
    symbolName,
    'Component'
  );
}

/**
 * Add an import to a Standalone Directive
 * @param host Virtual Tree
 * @param source TS Source File containing the Directive
 * @param directivePath The path to the Directive
 * @param symbolName The import to add to the Directive
 */
export function addImportToDirective(
  host: Tree,
  source: ts.SourceFile,
  directivePath: string,
  symbolName: string
): ts.SourceFile {
  return _addSymbolToDecoratorMetadata(
    host,
    source,
    directivePath,
    'imports',
    symbolName,
    'Directive'
  );
}

/**
 * Add an import to a Standalone Pipe
 * @param host Virtual Tree
 * @param source TS Source File containing the Pipe
 * @param pipePath The path to the Pipe
 * @param symbolName The import to add to the Pipe
 */
export function addImportToPipe(
  host: Tree,
  source: ts.SourceFile,
  pipePath: string,
  symbolName: string
): ts.SourceFile {
  return _addSymbolToDecoratorMetadata(
    host,
    source,
    pipePath,
    'imports',
    symbolName,
    'Pipe'
  );
}

/**
 * Add an import to an NgModule
 * @param host Virtual Tree
 * @param source TS Source File containing the NgModule
 * @param modulePath The path to the NgModule
 * @param symbolName The import to add to the NgModule
 */
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
  if (!tsModule) {
    tsModule = ensureTypescript();
  }
  const allCalls: ts.CallExpression[] = <any>(
    findNodes(source, tsModule.SyntaxKind.CallExpression)
  );

  const configureTestingModuleObjectLiterals = allCalls
    .filter(
      (c) => c.expression.kind === tsModule.SyntaxKind.PropertyAccessExpression
    )
    .filter(
      (c: any) => c.expression.name.getText(source) === 'configureTestingModule'
    )
    .map((c) =>
      c.arguments[0].kind === tsModule.SyntaxKind.ObjectLiteralExpression
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

export function addDeclarationsToTestBed(
  host: Tree,
  source: ts.SourceFile,
  specPath: string,
  symbolName: string[]
): ts.SourceFile {
  if (!tsModule) {
    tsModule = ensureTypescript();
  }
  const allCalls: ts.CallExpression[] = <any>(
    findNodes(source, tsModule.SyntaxKind.CallExpression)
  );

  const configureTestingModuleObjectLiterals = allCalls
    .filter(
      (c) => c.expression.kind === tsModule.SyntaxKind.PropertyAccessExpression
    )
    .filter(
      (c: any) => c.expression.name.getText(source) === 'configureTestingModule'
    )
    .map((c) =>
      c.arguments[0].kind === tsModule.SyntaxKind.ObjectLiteralExpression
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
      `declarations: [${symbolName.join(',')}], `
    );
  }
  return source;
}

export function replaceIntoToTestBed(
  host: Tree,
  source: ts.SourceFile,
  specPath: string,
  newSymbol: string,
  previousSymbol: string
): ts.SourceFile {
  if (!tsModule) {
    tsModule = ensureTypescript();
  }
  const allCalls: ts.CallExpression[] = <any>(
    findNodes(source, tsModule.SyntaxKind.CallExpression)
  );

  const configureTestingModuleObjectLiterals = allCalls
    .filter(
      (c) => c.expression.kind === tsModule.SyntaxKind.PropertyAccessExpression
    )
    .filter(
      (c: any) => c.expression.name.getText(source) === 'configureTestingModule'
    )
    .map((c) =>
      c.arguments[0].kind === tsModule.SyntaxKind.ObjectLiteralExpression
        ? c.arguments[0]
        : null
    );

  if (configureTestingModuleObjectLiterals.length > 0) {
    const startPosition = configureTestingModuleObjectLiterals[0]
      .getFirstToken(source)
      .getEnd();
    return replaceChange(
      host,
      source,
      specPath,
      startPosition,
      newSymbol,
      previousSymbol
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
  let node: any = nodes[0];

  if (!node) return null;

  // Get all the children property assignment of object literals.
  return getMatchingObjectLiteralElement(node, source, property);
}

export function addRouteToNgModule(
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
  if (!tsModule) {
    tsModule = ensureTypescript();
  }
  const imports: any = getMatchingProperty(
    source,
    'imports',
    'NgModule',
    '@angular/core'
  );

  if (
    imports?.initializer.kind === tsModule.SyntaxKind.ArrayLiteralExpression
  ) {
    const a = imports.initializer as ts.ArrayLiteralExpression;

    for (const e of a.elements) {
      if (e.kind === tsModule.SyntaxKind.CallExpression) {
        const ee = e as ts.CallExpression;
        const text = ee.expression.getText(source);
        if (
          (text === 'RouterModule.forRoot' ||
            text === 'RouterModule.forChild') &&
          ee.arguments.length > 0
        ) {
          const routes = ee.arguments[0];
          if (routes.kind === tsModule.SyntaxKind.ArrayLiteralExpression) {
            return (routes as ts.ArrayLiteralExpression).elements;
          } else if (routes.kind === tsModule.SyntaxKind.Identifier) {
            // find the array expression
            const variableDeclarations = findNodes(
              source,
              tsModule.SyntaxKind.VariableDeclaration
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

export function isNgStandaloneApp(tree: Tree, projectName: string) {
  const project = readProjectConfiguration(tree, projectName);
  const mainFile =
    project.targets?.build?.options?.main ??
    project.targets?.build?.options?.browser;

  if (project.projectType !== 'application' || !mainFile) {
    return false;
  }

  ensureTypescript();
  const { tsquery } = require('@phenomnomnominal/tsquery');

  const mainFileContents = tree.read(mainFile, 'utf-8');

  const BOOTSTRAP_APPLICATION_SELECTOR =
    'CallExpression:has(Identifier[name=bootstrapApplication])';
  const ast = tsquery.ast(mainFileContents);
  const nodes = tsquery(ast, BOOTSTRAP_APPLICATION_SELECTOR, {
    visitAllChildren: true,
  });
  return nodes.length > 0;
}

/**
 * Add a provider to bootstrapApplication call for Standalone Applications
 * @param tree Virtual Tree
 * @param filePath Path to the file containing the bootstrapApplication call
 * @param providerToAdd Provider to add
 */
export function addProviderToBootstrapApplication(
  tree: Tree,
  filePath: string,
  providerToAdd: string
) {
  ensureTypescript();
  const { tsquery } = require('@phenomnomnominal/tsquery');
  const PROVIDERS_ARRAY_SELECTOR =
    'CallExpression:has(Identifier[name=bootstrapApplication]) ObjectLiteralExpression > PropertyAssignment:has(Identifier[name=providers]) > ArrayLiteralExpression';

  const fileContents = tree.read(filePath, 'utf-8');
  const ast = tsquery.ast(fileContents);
  const providersArrayNodes = tsquery(ast, PROVIDERS_ARRAY_SELECTOR, {
    visitAllChildren: true,
  });
  if (providersArrayNodes.length === 0) {
    throw new Error(
      `Providers does not exist in the bootstrapApplication call within ${filePath}.`
    );
  }

  const arrayNode = providersArrayNodes[0];

  const newFileContents = `${fileContents.slice(
    0,
    arrayNode.getStart() + 1
  )}${providerToAdd},${fileContents.slice(
    arrayNode.getStart() + 1,
    fileContents.length
  )}`;

  tree.write(filePath, newFileContents);
}

/**
 * Add a provider to appConfig for Standalone Applications
 * NOTE: The appConfig must be marked with type ApplicationConfig and the providers must be declared as an array in the config
 * @param tree Virtual Tree
 * @param filePath Path to the file containing the bootstrapApplication call
 * @param providerToAdd Provider to add
 */
export function addProviderToAppConfig(
  tree: Tree,
  filePath: string,
  providerToAdd: string
) {
  ensureTypescript();
  const { tsquery } = require('@phenomnomnominal/tsquery');
  const PROVIDERS_ARRAY_SELECTOR =
    'VariableDeclaration:has(TypeReference > Identifier[name=ApplicationConfig]) > ObjectLiteralExpression  PropertyAssignment:has(Identifier[name=providers]) > ArrayLiteralExpression';

  const fileContents = tree.read(filePath, 'utf-8');
  const ast = tsquery.ast(fileContents);
  const providersArrayNodes = tsquery(ast, PROVIDERS_ARRAY_SELECTOR, {
    visitAllChildren: true,
  });
  if (providersArrayNodes.length === 0) {
    throw new Error(
      `'providers' does not exist in the application configuration at '${filePath}'.`
    );
  }

  const arrayNode = providersArrayNodes[0];

  const newFileContents = `${fileContents.slice(
    0,
    arrayNode.getStart() + 1
  )}${providerToAdd},${fileContents.slice(
    arrayNode.getStart() + 1,
    fileContents.length
  )}`;

  tree.write(filePath, newFileContents);
}

/**
 * Add a provider to an NgModule
 * @param host Virtual Tree
 * @param source TS Source File containing the NgModule
 * @param modulePath Path to the NgModule
 * @param symbolName The provider to add
 */
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

/**
 * Add a provider to a Standalone Component
 * @param host Virtual Tree
 * @param source TS Source File containing the Component
 * @param componentPath Path to the Component
 * @param symbolName The provider to add
 */
export function addProviderToComponent(
  host: Tree,
  source: ts.SourceFile,
  componentPath: string,
  symbolName: string
): ts.SourceFile {
  return _addSymbolToDecoratorMetadata(
    host,
    source,
    componentPath,
    'providers',
    symbolName,
    'Component'
  );
}

/**
 * Add a view provider to a Standalone Component
 * @param host Virtual Tree
 * @param source TS Source File containing the Component
 * @param componentPath Path to the Component
 * @param symbolName The provider to add
 */
export function addViewProviderToComponent(
  host: Tree,
  source: ts.SourceFile,
  componentPath: string,
  symbolName: string
): ts.SourceFile {
  return _addSymbolToDecoratorMetadata(
    host,
    source,
    componentPath,
    'viewProviders',
    symbolName,
    'Component'
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
  if (!tsModule) {
    tsModule = ensureTypescript();
  }
  const config = readProjectConfiguration(host, app);

  let mainPath;
  try {
    mainPath =
      config.targets.build.options.main ?? config.targets.build.options.browser;
  } catch (e) {
    throw new Error('Main file cannot be located');
  }

  if (!host.exists(mainPath)) {
    throw new Error('Main file cannot be located');
  }

  const mainSource = host.read(mainPath)!.toString('utf-8');
  const main = tsModule.createSourceFile(
    mainPath,
    mainSource,
    tsModule.ScriptTarget.Latest,
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

  const modulePath = `${join(dirname(mainPath), moduleImport.moduleSpec)}.ts`;
  if (!host.exists(modulePath)) {
    throw new Error(`Cannot find '${modulePath}'`);
  }

  const moduleSourceText = host.read(modulePath)!.toString('utf-8');
  const moduleSource = tsModule.createSourceFile(
    modulePath,
    moduleSourceText,
    tsModule.ScriptTarget.Latest,
    true
  );

  const bootstrapComponentClassName = getBootstrapComponent(
    moduleSource,
    moduleClassName
  );
  const bootstrapComponentFileName = `./${join(
    dirname(moduleImport.moduleSpec),
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
  if (!tsModule) {
    tsModule = ensureTypescript();
  }
  const moduleSourceText = host.read(modulePath)!.toString('utf-8');
  const moduleSource = tsModule.createSourceFile(
    modulePath,
    moduleSourceText,
    tsModule.ScriptTarget.Latest,
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
  if (!tsModule) {
    tsModule = ensureTypescript();
  }
  return (
    (node as ts.ObjectLiteralExpression).properties
      .filter((prop) => prop.kind == tsModule.SyntaxKind.PropertyAssignment)
      // Filter out every fields that's not "metadataField". Also handles string literals
      // (but not expressions).
      .filter((prop: ts.PropertyAssignment) => {
        const name = prop.name;
        switch (name.kind) {
          case tsModule.SyntaxKind.Identifier:
            return (name as ts.Identifier).getText(source) === property;
          case tsModule.SyntaxKind.StringLiteral:
            return (name as ts.StringLiteral).text === property;
        }
        return false;
      })[0]
  );
}

export function getTsSourceFile(host: Tree, path: string): ts.SourceFile {
  if (!tsModule) {
    tsModule = ensureTypescript();
  }
  const buffer = host.read(path);
  if (!buffer) {
    throw new Error(`Could not read TS file (${path}).`);
  }
  const content = buffer.toString();
  const source = tsModule.createSourceFile(
    path,
    content,
    tsModule.ScriptTarget.Latest,
    true
  );

  return source;
}
