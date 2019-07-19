/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT- style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { Rule, Tree, SchematicContext } from '@angular-devkit/schematics';
import * as ts from 'typescript';
import * as stripJsonComments from 'strip-json-comments';
import { serializeJson } from './fileutils';
import { NodePackageInstallTask } from '@angular-devkit/schematics/tasks';

function nodesByPosition(first: ts.Node, second: ts.Node): number {
  return first.getStart() - second.getStart();
}

function insertAfterLastOccurrence(
  nodes: ts.Node[],
  toInsert: string,
  file: string,
  fallbackPos: number,
  syntaxKind?: ts.SyntaxKind
): Change {
  // sort() has a side effect, so make a copy so that we won't overwrite the parent's object.
  let lastItem = [...nodes].sort(nodesByPosition).pop();
  if (!lastItem) {
    throw new Error();
  }
  if (syntaxKind) {
    lastItem = findNodes(lastItem, syntaxKind)
      .sort(nodesByPosition)
      .pop();
  }
  if (!lastItem && fallbackPos == undefined) {
    throw new Error(
      `tried to insert ${toInsert} as first occurence with no fallback position`
    );
  }
  const lastItemPosition: number = lastItem ? lastItem.getEnd() : fallbackPos;

  return new InsertChange(file, lastItemPosition, toInsert);
}

export function findNodes(
  node: ts.Node,
  kind: ts.SyntaxKind,
  max = Infinity
): ts.Node[] {
  if (!node || max == 0) {
    return [];
  }

  const arr: ts.Node[] = [];
  if (node.kind === kind) {
    arr.push(node);
    max--;
  }
  if (max > 0) {
    for (const child of node.getChildren()) {
      findNodes(child, kind, max).forEach(node => {
        if (max > 0) {
          arr.push(node);
        }
        max--;
      });

      if (max <= 0) {
        break;
      }
    }
  }

  return arr;
}

export function getSourceNodes(sourceFile: ts.SourceFile): ts.Node[] {
  const nodes: ts.Node[] = [sourceFile];
  const result = [];

  while (nodes.length > 0) {
    const node = nodes.shift();

    if (node) {
      result.push(node);
      if (node.getChildCount(sourceFile) >= 0) {
        nodes.unshift(...node.getChildren());
      }
    }
  }

  return result;
}

export interface Change {
  apply(host: any): Promise<void>;

  readonly type: string;
  readonly path: string | null;
  readonly order: number;
  readonly description: string;
}

export class NoopChange implements Change {
  type = 'noop';
  description = 'No operation.';
  order = Infinity;
  path = null;

  apply() {
    return Promise.resolve();
  }
}

export class InsertChange implements Change {
  type = 'insert';
  order: number;
  description: string;

  constructor(public path: string, public pos: number, public toAdd: string) {
    if (pos < 0) {
      throw new Error('Negative positions are invalid');
    }
    this.description = `Inserted ${toAdd} into position ${pos} of ${path}`;
    this.order = pos;
  }

  apply(host: any) {
    return host.read(this.path).then(content => {
      const prefix = content.substring(0, this.pos);
      const suffix = content.substring(this.pos);

      return host.write(this.path, `${prefix}${this.toAdd}${suffix}`);
    });
  }
}

export class RemoveChange implements Change {
  type = 'remove';
  order: number;
  description: string;

  constructor(
    public path: string,
    private pos: number,
    private toRemove: string
  ) {
    if (pos < 0) {
      throw new Error('Negative positions are invalid');
    }
    this.description = `Removed ${toRemove} into position ${pos} of ${path}`;
    this.order = pos;
  }

  apply(host: any): Promise<void> {
    return host.read(this.path).then(content => {
      const prefix = content.substring(0, this.pos);
      const suffix = content.substring(this.pos + this.toRemove.length);
      return host.write(this.path, `${prefix}${suffix}`);
    });
  }
}

export class ReplaceChange implements Change {
  type = 'replace';
  order: number;
  description: string;

  constructor(
    public path: string,
    private pos: number,
    private oldText: string,
    private newText: string
  ) {
    if (pos < 0) {
      throw new Error('Negative positions are invalid');
    }
    this.description = `Replaced ${oldText} into position ${pos} of ${path} with ${newText}`;
    this.order = pos;
  }

  apply(host: any): Promise<void> {
    return host.read(this.path).then(content => {
      const prefix = content.substring(0, this.pos);
      const suffix = content.substring(this.pos + this.oldText.length);
      const text = content.substring(this.pos, this.pos + this.oldText.length);
      if (text !== this.oldText) {
        return Promise.reject(
          new Error(`Invalid replace: "${text}" != "${this.oldText}".`)
        );
      }
      return host.write(this.path, `${prefix}${this.newText}${suffix}`);
    });
  }
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

export function findClass(
  source: ts.SourceFile,
  className: string,
  silent: boolean = false
): ts.ClassDeclaration {
  const nodes = getSourceNodes(source);

  const clazz = <any>(
    nodes.filter(
      n =>
        n.kind === ts.SyntaxKind.ClassDeclaration &&
        (<any>n).name.text === className
    )[0]
  );

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

export function insert(host: Tree, modulePath: string, changes: any[]) {
  if (changes.length < 1) {
    return;
  }
  const recorder = host.beginUpdate(modulePath);
  for (const change of changes) {
    if (change.type === 'insert') {
      recorder.insertLeft(change.pos, change.toAdd);
    } else if (change.type === 'remove') {
      recorder.remove((<any>change).pos - 1, (<any>change).toRemove.length + 1);
    } else if (change.type === 'noop') {
      // do nothing
    } else if (change.type === 'replace') {
      const action = <any>change;
      recorder.remove(action.pos, action.oldText.length);
      recorder.insertLeft(action.pos, action.newText);
    } else {
      throw new Error(`Unexpected Change '${change.constructor.name}'`);
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
  const contents = stripJsonComments(host.read(path)!.toString('utf-8'));
  try {
    return JSON.parse(contents);
  } catch (e) {
    throw new Error(`Cannot parse ${path}: ${e.message}`);
  }
}

/**
 * This method is specifically for updating JSON in a Tree
 * @param path Path of JSON file in the Tree
 * @param callback Manipulation of the JSON data
 * @returns A rule which updates a JSON file file in a Tree
 */
export function updateJsonInTree<T = any, O = T>(
  path: string,
  callback: (json: T, context: SchematicContext) => O
): Rule {
  return (host: Tree, context: SchematicContext): Tree => {
    if (!host.exists(path)) {
      host.create(path, serializeJson(callback({} as T, context)));
      return host;
    }
    host.overwrite(
      path,
      serializeJson(callback(readJsonInTree(host, path), context))
    );
    return host;
  };
}

let installAdded = false;

export function addDepsToPackageJson(
  deps: any,
  devDeps: any,
  addInstall = true
): Rule {
  return updateJsonInTree('package.json', (json, context: SchematicContext) => {
    json.dependencies = {
      ...(json.dependencies || {}),
      ...deps,
      ...(json.dependencies || {})
    };
    json.devDependencies = {
      ...(json.devDependencies || {}),
      ...devDeps,
      ...(json.devDependencies || {})
    };
    if (addInstall && !installAdded) {
      context.addTask(new NodePackageInstallTask());
      installAdded = true;
    }
    return json;
  });
}

export function updatePackageJsonDependencies(
  deps: any,
  devDeps: any,
  addInstall = true
): Rule {
  return updateJsonInTree('package.json', (json, context: SchematicContext) => {
    json.dependencies = {
      ...(json.dependencies || {}),
      ...deps
    };
    json.devDependencies = {
      ...(json.devDependencies || {}),
      ...devDeps
    };
    if (addInstall && !installAdded) {
      context.addTask(new NodePackageInstallTask());
      installAdded = true;
    }
    return json;
  });
}

export function getProjectConfig(host: Tree, name: string): any {
  const angularJson = readJsonInTree(host, '/angular.json');
  const projectConfig = angularJson.projects[name];
  if (!projectConfig) {
    throw new Error(`Cannot find project '${name}'`);
  } else {
    return projectConfig;
  }
}

export function createOrUpdate(host: Tree, path: string, content: string) {
  if (host.exists(path)) {
    host.overwrite(path, content);
  } else {
    host.create(path, content);
  }
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

export function replaceNodeValue(
  host: Tree,
  modulePath: string,
  node: ts.Node,
  content: string
) {
  insert(host, modulePath, [
    new ReplaceChange(
      modulePath,
      node.getStart(node.getSourceFile()),
      node.getFullText(),
      content
    )
  ]);
}
