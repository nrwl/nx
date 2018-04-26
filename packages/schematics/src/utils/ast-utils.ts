/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT- style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { Tree, Rule } from '@angular-devkit/schematics';
import {
  findNodes,
  getDecoratorMetadata,
  getSourceNodes,
  insertAfterLastOccurrence
} from '@schematics/angular/utility/ast-utils';
import {
  Change,
  InsertChange,
  NoopChange,
  RemoveChange,
  ReplaceChange
} from '@schematics/angular/utility/change';

import * as ts from 'typescript';
import * as path from 'path';
import { toFileName } from './name-utils';
import { serializeJson } from './fileutils';

// This should be moved to @schematics/angular once it allows to pass custom expressions as providers
function _addSymbolToNgModuleMetadata(
  source: ts.SourceFile,
  ngModulePath: string,
  metadataField: string,
  expression: string
): Change[] {
  const nodes = getDecoratorMetadata(source, 'NgModule', '@angular/core');
  let node: any = nodes[0]; // tslint:disable-line:no-any

  // Find the decorator declaration.
  if (!node) {
    return [];
  }
  // Get all the children property assignment of object literals.
  const matchingProperties: ts.ObjectLiteralElement[] = (node as ts.ObjectLiteralExpression).properties
    .filter(prop => prop.kind == ts.SyntaxKind.PropertyAssignment)
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

  if (Array.isArray(node)) {
    const nodeArray = (node as {}) as Array<ts.Node>;
    const symbolsArray = nodeArray.map(node => node.getText());
    if (symbolsArray.includes(expression)) {
      return [];
    }

    node = node[node.length - 1];
  }

  let toInsert: string;
  let position = node.getEnd();
  if (node.kind == ts.SyntaxKind.ObjectLiteralExpression) {
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
  } else if (node.kind == ts.SyntaxKind.ArrayLiteralExpression) {
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

export function addParameterToConstructor(
  source: ts.SourceFile,
  modulePath: string,
  opts: { className: string; param: string }
): Change[] {
  const clazz = findClass(source, opts.className);
  const constructor = clazz.members.filter(
    m => m.kind === ts.SyntaxKind.Constructor
  )[0];
  if (constructor) {
    throw new Error('Should be tested');
  } else {
    const methodHeader = `constructor(${opts.param})`;
    return addMethod(source, modulePath, {
      className: opts.className,
      methodHeader,
      body: null
    });
  }
}

export function addMethod(
  source: ts.SourceFile,
  modulePath: string,
  opts: { className: string; methodHeader: string; body: string }
): Change[] {
  const clazz = findClass(source, opts.className);
  const body = opts.body
    ? `
${opts.methodHeader} {
${offset(opts.body, 1, false)}
}
`
    : `
${opts.methodHeader} {}
`;

  return [new InsertChange(modulePath, clazz.end - 1, offset(body, 1, true))];
}

export function removeFromNgModule(
  source: ts.SourceFile,
  modulePath: string,
  property: string
): Change[] {
  const nodes = getDecoratorMetadata(source, 'NgModule', '@angular/core');
  let node: any = nodes[0]; // tslint:disable-line:no-any

  // Find the decorator declaration.
  if (!node) {
    return [];
  }

  // Get all the children property assignment of object literals.
  const matchingProperty = getMatchingProperty(source, property);
  if (matchingProperty) {
    return [
      new RemoveChange(
        modulePath,
        matchingProperty.pos,
        matchingProperty.getFullText(source)
      )
    ];
  } else {
    return [];
  }
}

export function findClass(
  source: ts.SourceFile,
  className: string,
  silent: boolean = false
): ts.ClassDeclaration {
  const nodes = getSourceNodes(source);

  const clazz = <any>nodes.filter(
    n =>
      n.kind === ts.SyntaxKind.ClassDeclaration &&
      (<any>n).name.text === className
  )[0];

  if (!clazz && !silent) {
    throw new Error(`Cannot find class '${className}'`);
  }

  return clazz;
}

export function offset(
  text: string,
  numberOfTabs: number,
  wrap: boolean
): string {
  const lines = text
    .trim()
    .split('\n')
    .map(line => {
      let tabs = '';
      for (let c = 0; c < numberOfTabs; ++c) {
        tabs += '  ';
      }
      return `${tabs}${line}`;
    })
    .join('\n');

  return wrap ? `\n${lines}\n` : lines;
}

export function addImportToModule(
  source: ts.SourceFile,
  modulePath: string,
  symbolName: string
): Change[] {
  return _addSymbolToNgModuleMetadata(
    source,
    modulePath,
    'imports',
    symbolName
  );
}

export function addImportToTestBed(
  source: ts.SourceFile,
  specPath: string,
  symbolName: string
): Change[] {
  const allCalls: ts.CallExpression[] = <any>findNodes(
    source,
    ts.SyntaxKind.CallExpression
  );

  const configureTestingModuleObjectLiterals = allCalls
    .filter(c => c.expression.kind === ts.SyntaxKind.PropertyAccessExpression)
    .filter(
      (c: any) => c.expression.name.getText(source) === 'configureTestingModule'
    )
    .map(
      c =>
        c.arguments[0].kind === ts.SyntaxKind.ObjectLiteralExpression
          ? c.arguments[0]
          : null
    );

  if (configureTestingModuleObjectLiterals.length > 0) {
    const startPosition = configureTestingModuleObjectLiterals[0]
      .getFirstToken(source)
      .getEnd();
    return [
      new InsertChange(specPath, startPosition, `imports: [${symbolName}], `)
    ];
  } else {
    return [];
  }
}

export function addReexport(
  source: ts.SourceFile,
  modulePath: string,
  reexportedFileName: string,
  token: string
): Change[] {
  const allExports = findNodes(source, ts.SyntaxKind.ExportDeclaration);
  if (allExports.length > 0) {
    const m = allExports.filter(
      (e: ts.ExportDeclaration) =>
        e.moduleSpecifier.getText(source).indexOf(reexportedFileName) > -1
    );
    if (m.length > 0) {
      const mm: ts.ExportDeclaration = <any>m[0];
      return [
        new InsertChange(modulePath, mm.exportClause.end - 1, `, ${token} `)
      ];
    }
  }
  return [];
}

export function getBootstrapComponent(
  source: ts.SourceFile,
  moduleClassName: string
): string {
  const bootstrap = getMatchingProperty(source, 'bootstrap');
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

function getMatchingObjectLiteralElement(
  node: any,
  source: ts.SourceFile,
  property: string
) {
  return (
    (node as ts.ObjectLiteralExpression).properties
      .filter(prop => prop.kind == ts.SyntaxKind.PropertyAssignment)
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

function getMatchingProperty(
  source: ts.SourceFile,
  property: string
): ts.ObjectLiteralElement {
  const nodes = getDecoratorMetadata(source, 'NgModule', '@angular/core');
  let node: any = nodes[0]; // tslint:disable-line:no-any

  if (!node) return null;

  // Get all the children property assignment of object literals.
  return getMatchingObjectLiteralElement(node, source, property);
}

export function addRoute(
  ngModulePath: string,
  source: ts.SourceFile,
  route: string
): Change[] {
  const routes = getListOfRoutes(source);
  if (!routes) return [];

  if (routes.hasTrailingComma || routes.length === 0) {
    return [new InsertChange(ngModulePath, routes.end, route)];
  } else {
    return [new InsertChange(ngModulePath, routes.end, `, ${route}`)];
  }
}

export function addIncludeToTsConfig(
  tsConfigPath: string,
  source: ts.SourceFile,
  include: string
): Change[] {
  const includeKeywordPos = source.text.indexOf('"include":');
  if (includeKeywordPos > -1) {
    const includeArrayEndPos = source.text.indexOf(']', includeKeywordPos);
    return [new InsertChange(tsConfigPath, includeArrayEndPos, include)];
  } else {
    return [];
  }
}

function getListOfRoutes(source: ts.SourceFile): ts.NodeArray<ts.Expression> {
  const imports: any = getMatchingProperty(source, 'imports');

  if (imports.initializer.kind === ts.SyntaxKind.ArrayLiteralExpression) {
    const a = imports.initializer as ts.ArrayLiteralExpression;

    for (let e of a.elements) {
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
          }
        }
      }
    }
  }
  return null;
}

export function getImport(
  source: ts.SourceFile,
  predicate: (a: any) => boolean
): { moduleSpec: string; bindings: string[] }[] {
  const allImports = findNodes(source, ts.SyntaxKind.ImportDeclaration);
  const matching = allImports.filter((i: ts.ImportDeclaration) =>
    predicate(i.moduleSpecifier.getText())
  );

  return matching.map((i: ts.ImportDeclaration) => {
    const moduleSpec = i.moduleSpecifier
      .getText()
      .substring(1, i.moduleSpecifier.getText().length - 1);
    const t = i.importClause.namedBindings.getText();
    const bindings = t
      .replace('{', '')
      .replace('}', '')
      .split(',')
      .map(q => q.trim());
    return { moduleSpec, bindings };
  });
}

export function addProviderToModule(
  source: ts.SourceFile,
  modulePath: string,
  symbolName: string
): Change[] {
  return _addSymbolToNgModuleMetadata(
    source,
    modulePath,
    'providers',
    symbolName
  );
}

export function addDeclarationToModule(
  source: ts.SourceFile,
  modulePath: string,
  symbolName: string
): Change[] {
  return _addSymbolToNgModuleMetadata(
    source,
    modulePath,
    'declarations',
    symbolName
  );
}

export function addEntryComponents(
  source: ts.SourceFile,
  modulePath: string,
  symbolName: string
): Change[] {
  return _addSymbolToNgModuleMetadata(
    source,
    modulePath,
    'entryComponents',
    symbolName
  );
}

export function addGlobal(
  source: ts.SourceFile,
  modulePath: string,
  statement: string
): Change[] {
  const allImports = findNodes(source, ts.SyntaxKind.ImportDeclaration);
  if (allImports.length > 0) {
    const lastImport = allImports[allImports.length - 1];
    return [
      new InsertChange(modulePath, lastImport.end + 1, `\n${statement}\n`)
    ];
  } else {
    return [new InsertChange(modulePath, 0, `${statement}\n`)];
  }
}

export function insert(host: Tree, modulePath: string, changes: Change[]) {
  const recorder = host.beginUpdate(modulePath);
  for (const change of changes) {
    if (change instanceof InsertChange) {
      recorder.insertLeft(change.pos, change.toAdd);
    } else if (change instanceof RemoveChange) {
      recorder.remove((<any>change).pos - 1, (<any>change).toRemove.length + 1);
    } else if (change instanceof NoopChange) {
      // do nothing
    } else if (change instanceof ReplaceChange) {
      const action = <any>change;
      recorder.remove(action.pos + 1, action.oldText.length);
      recorder.insertLeft(action.pos + 1, action.newText);
    } else {
      throw new Error(`Unexpected Change '${change}'`);
    }
  }
  host.commitUpdate(recorder);
}

/**
 * This method is specifically for reading JSON files in a Tree
 * @param host The host tree
 * @param path The path to the JSON file
 * @returns The JSON data in the file.
 */
export function readJsonInTree<T = any>(host: Tree, path: string): T {
  if (!host.exists(path)) {
    throw new Error(`Cannot find ${path}`);
  }
  return JSON.parse(host.read(path)!.toString('utf-8'));
}

/**
 * This method is specifically for updating JSON in a Tree
 * @param path Path of JSON file in the Tree
 * @param callback Manipulation of the JSON data
 * @returns A rule which updates a JSON file file in a Tree
 */
export function updateJsonInTree<T = any, O = T>(
  path: string,
  callback: (json: T) => O
): Rule {
  return (host: Tree): Tree => {
    host.overwrite(path, serializeJson(callback(readJsonInTree(host, path))));
    return host;
  };
}

// TODO DELETE THIS
/**
 * This method is specifically for getting the .angular-cli.json data from a Tree
 * @param host The host tree
 */
export function getAngularCliConfig(host: Tree) {
  return readJsonInTree(host, '.angular-cli.json');
}

// TODO DELETE THIS
export function getAppConfig(host: Tree, name: string): any {
  const angularCliJson = getAngularCliConfig(host);
  const apps = angularCliJson.apps;
  if (!apps || apps.length === 0) {
    throw new Error(`Cannot find app '${name}'`);
  }
  if (name) {
    const appConfig = apps.filter(a => a.name === name)[0];
    if (!appConfig) {
      throw new Error(`Cannot find app '${name}'`);
    } else {
      return appConfig;
    }
  }
  return apps[0];
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
  const config = getAppConfig(host, app);
  const mainPath = path.join(config.root, config.main);
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
  const moduleClassName = moduleImport.bindings.filter(b =>
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
    `${toFileName(
      bootstrapComponentClassName.substring(
        0,
        bootstrapComponentClassName.length - 9
      )
    )}.component`
  )}`;

  return {
    moduleSpec: moduleImport.moduleSpec,
    mainPath,
    modulePath,
    moduleSource,
    moduleClassName,
    bootstrapComponentClassName,
    bootstrapComponentFileName
  };
}

export function addClass(
  source: ts.SourceFile,
  modulePath: string,
  clazzName: string,
  clazzSrc: string
): Change {
  if (!findClass(source, clazzName, true)) {
    const nodes = findNodes(source, ts.SyntaxKind.ClassDeclaration);
    return insertAfterLastOccurrence(
      nodes,
      offset(clazzSrc, 0, true),
      modulePath,
      0,
      ts.SyntaxKind.ClassDeclaration
    );
  }
  return new NoopChange();
}

export function addUnionTypes(
  source: ts.SourceFile,
  modulePath: string,
  typeName: string,
  typeValues: string[]
) {
  const target: ts.TypeAliasDeclaration = findNodesOfType(
    source,
    ts.SyntaxKind.TypeAliasDeclaration,
    it => it.name.getText() === typeName
  );
  if (!target) {
    throw new Error(`Cannot find union type '${typeName}'`);
  }

  const node = target.type as ts.TypeReferenceNode;

  // Append new types to create a union type...
  return new InsertChange(
    modulePath,
    node.end,
    ['', ...typeValues].join(' | ')
  );
}

/**
 * Add 1..n enumerators using name + (optional) value pairs
 */
export function addEnumeratorValues(
  source: ts.SourceFile,
  modulePath: string,
  enumName: string,
  pairs: NameValue[] = []
): Change[] {
  const target = findNodesOfType(
    source,
    ts.SyntaxKind.EnumDeclaration,
    it => it.name.getText() === enumName
  );
  const list = target ? target.members : undefined;
  if (!target) {
    throw new Error(`Cannot find enum '${enumName}'`);
  }
  const addComma = !(list.hasTrailingComma || list.length === 0);

  return pairs.reduce((buffer, it) => {
    const member = it.value ? `${it.name} = '${it.value}'` : it.name;
    const memberExists = () => {
      return list.filter(m => m.name.getText() === it.name).length;
    };

    if (memberExists()) {
      throw new Error(`Enum '${enumName}.${it.name}' already exists`);
    }

    return [
      ...buffer,
      new InsertChange(modulePath, list.end, (addComma ? ', ' : '') + member)
    ];
  }, []);
}

/**
 * Find Enum declaration in source based on name
 * e.g.
 *    export enum ProductsActionTypes {
 *       ProductsAction = '[Products] Action'
 *    }
 */
const IDENTITY = a => a;
export function findNodesOfType(
  source: ts.Node,
  kind: ts.SyntaxKind,
  predicate: (a: any) => boolean,
  extract: (a: any) => any = IDENTITY,
  firstOnly: boolean = true
): any {
  const nodes = findNodes(source, kind);
  const matching = nodes.filter((i: any) => predicate(i)).map(extract);
  return matching.length ? (firstOnly ? matching[0] : matching) : undefined;
}

export interface NameValue {
  name: string;
  value?: string;
}

export function insertImport(
  source: ts.SourceFile,
  fileToEdit: string,
  symbolName: string,
  fileName: string,
  isDefault = false
): Change {
  const rootNode = source;
  const allImports = findNodes(rootNode, ts.SyntaxKind.ImportDeclaration);

  // get nodes that map to import statements from the file fileName
  const relevantImports = allImports.filter(node => {
    // StringLiteral of the ImportDeclaration is the import file (fileName in this case).
    const importFiles = node
      .getChildren()
      .filter(child => child.kind === ts.SyntaxKind.StringLiteral)
      .map(n => (n as ts.StringLiteral).text);

    return importFiles.filter(file => file === fileName).length === 1;
  });

  if (relevantImports.length > 0) {
    let importsAsterisk = false;
    // imports from import file
    const imports: ts.Node[] = [];
    relevantImports.forEach(n => {
      Array.prototype.push.apply(
        imports,
        findNodes(n, ts.SyntaxKind.Identifier)
      );
      if (findNodes(n, ts.SyntaxKind.AsteriskToken).length > 0) {
        importsAsterisk = true;
      }
    });

    // if imports * from fileName, don't add symbolName
    if (importsAsterisk) {
      return new NoopChange();
    }

    const importTextNodes = imports.filter(
      n => (n as ts.Identifier).text === symbolName
    );

    // insert import if it's not there
    if (importTextNodes.length === 0) {
      const fallbackPos =
        findNodes(
          relevantImports[0],
          ts.SyntaxKind.CloseBraceToken
        )[0].getStart() ||
        findNodes(relevantImports[0], ts.SyntaxKind.FromKeyword)[0].getStart();

      return insertAfterLastOccurrence(
        imports,
        `, ${symbolName}`,
        fileToEdit,
        fallbackPos
      );
    }

    return new NoopChange();
  }

  // no such import declaration exists
  const useStrict = findNodes(rootNode, ts.SyntaxKind.StringLiteral).filter(
    (n: ts.StringLiteral) => n.text === 'use strict'
  );
  let fallbackPos = 0;
  if (useStrict.length > 0) {
    fallbackPos = useStrict[0].end;
  }
  const open = isDefault ? '' : '{ ';
  const close = isDefault ? '' : ' }';
  // if there are no imports or 'use strict' statement, insert import at beginning of file
  const insertAtBeginning = allImports.length === 0 && useStrict.length === 0;
  const separator = insertAtBeginning ? '' : ';\n';
  const toInsert =
    `${separator}import ${open}${symbolName}${close}` +
    ` from '${fileName}'${insertAtBeginning ? ';\n' : ''}`;

  return insertAfterLastOccurrence(
    allImports,
    toInsert,
    fileToEdit,
    fallbackPos,
    ts.SyntaxKind.StringLiteral
  );
}
