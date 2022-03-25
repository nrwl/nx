/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT- style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import {
  apply,
  chain,
  DirEntry,
  forEach,
  mergeWith,
  noop,
  Rule,
  SchematicContext,
  Source,
  Tree,
} from '@angular-devkit/schematics';
import * as ts from 'typescript';
import {
  parseJson,
  ProjectConfiguration,
  serializeJson,
  FileData,
} from '@nrwl/devkit';
import { getWorkspacePath } from './cli-config-utils';
import { extname, join, normalize, Path } from '@angular-devkit/core';
import type {
  NxJsonConfiguration,
  WorkspaceJsonConfiguration,
} from '@nrwl/devkit';
import { addInstallTask } from './rules/add-install-task';
import { findNodes } from '../utilities/typescript/find-nodes';
import { getSourceNodes } from '../utilities/typescript/get-source-nodes';

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
    lastItem = findNodes(lastItem, syntaxKind).sort(nodesByPosition).pop();
  }
  if (!lastItem && fallbackPos == undefined) {
    throw new Error(
      `tried to insert ${toInsert} as first occurrence with no fallback position`
    );
  }
  const lastItemPosition: number = lastItem ? lastItem.getEnd() : fallbackPos;

  return new InsertChange(file, lastItemPosition, toInsert);
}

export function sortObjectByKeys(obj: unknown) {
  return Object.keys(obj)
    .sort()
    .reduce((result, key) => {
      return {
        ...result,
        [key]: obj[key],
      };
    }, {});
}

export { findNodes } from '../utilities/typescript/find-nodes';
export { getSourceNodes } from '../utilities/typescript/get-source-nodes';

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
    return host.read(this.path).then((content) => {
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
    public pos: number,
    public toRemove: string
  ) {
    if (pos < 0) {
      throw new Error('Negative positions are invalid');
    }
    this.description = `Removed ${toRemove} into position ${pos} of ${path}`;
    this.order = pos;
  }

  apply(host: any): Promise<void> {
    return host.read(this.path).then((content) => {
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
    public pos: number,
    public oldText: string,
    public newText: string
  ) {
    if (pos < 0) {
      throw new Error('Negative positions are invalid');
    }
    this.description = `Replaced ${oldText} into position ${pos} of ${path} with ${newText}`;
    this.order = pos;
  }

  apply(host: any): Promise<void> {
    return host.read(this.path).then((content) => {
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
    (m) => m.kind === ts.SyntaxKind.Constructor
  )[0];
  if (constructor) {
    throw new Error('Should be tested');
  } else {
    const methodHeader = `constructor(${opts.param})`;
    return addMethod(source, modulePath, {
      className: opts.className,
      methodHeader,
      body: null,
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
      (n) =>
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
    .map((line) => {
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
      .map((q) => q.trim());
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
      new InsertChange(modulePath, lastImport.end + 1, `\n${statement}\n`),
    ];
  } else {
    return [new InsertChange(modulePath, 0, `${statement}\n`)];
  }
}

export function insert(host: Tree, modulePath: string, changes: Change[]) {
  if (changes.length < 1) {
    return;
  }

  // sort changes so that the highest pos goes first
  const orderedChanges = changes.sort((a, b) => b.order - a.order) as any;

  const recorder = host.beginUpdate(modulePath);
  for (const change of orderedChanges) {
    if (change.type == 'insert') {
      recorder.insertLeft(change.pos, change.toAdd);
    } else if (change.type == 'remove') {
      recorder.remove(change.pos - 1, change.toRemove.length + 1);
    } else if (change.type == 'replace') {
      recorder.remove(change.pos, change.oldText.length);
      recorder.insertLeft(change.pos, change.newText);
    } else if (change.type === 'noop') {
      // do nothing
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
export function readJsonInTree<T extends object = any>(
  host: Tree,
  path: string
): T {
  if (!host.exists(path)) {
    throw new Error(`Cannot find ${path}`);
  }
  try {
    return parseJson(host.read(path)!.toString('utf-8'));
  } catch (e) {
    throw new Error(`Cannot parse ${path}: ${e.message}`);
  }
}

// TODO(v13): remove this deprecated method
/**
 * @deprecated This method is deprecated
 */
export function getFileDataInHost(host: Tree, path: Path): FileData {
  return {
    file: path,
    ext: extname(normalize(path)),
    hash: '',
  };
}

export function allFilesInDirInHost(
  host: Tree,
  path: Path,
  options: {
    recursive: boolean;
  } = { recursive: true }
): Path[] {
  const dir = host.getDir(path);
  const res: Path[] = [];
  dir.subfiles.forEach((p) => {
    res.push(join(path, p));
  });

  if (!options.recursive) {
    return res;
  }

  dir.subdirs.forEach((p) => {
    res.push(...allFilesInDirInHost(host, join(path, p)));
  });
  return res;
}

/**
 * This method is specifically for updating JSON in a Tree
 * @param path Path of JSON file in the Tree
 * @param callback Manipulation of the JSON data
 * @returns A rule which updates a JSON file file in a Tree
 */
export function updateJsonInTree<T extends object = any, O extends object = T>(
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

export function updateWorkspaceInTree<
  T extends object = any,
  O extends object = T
>(callback: (json: T, context: SchematicContext, host: Tree) => O): Rule {
  return (host: Tree, context: SchematicContext = undefined): Tree => {
    const path = getWorkspacePath(host);
    host.overwrite(
      path,
      serializeJson(callback(readJsonInTree(host, path), context, host))
    );
    return host;
  };
}

export function readNxJsonInTree(host: Tree) {
  return readJsonInTree<NxJsonConfiguration>(host, 'nx.json');
}

export function libsDir(host: Tree) {
  const json = readJsonInTree<NxJsonConfiguration>(host, 'nx.json');
  return json?.workspaceLayout?.libsDir ?? 'libs';
}

export function appsDir(host: Tree) {
  const json = readJsonInTree<NxJsonConfiguration>(host, 'nx.json');
  return json?.workspaceLayout?.appsDir ?? 'apps';
}

export function updateNxJsonInTree(
  callback: (
    json: NxJsonConfiguration,
    context: SchematicContext
  ) => NxJsonConfiguration
): Rule {
  return (host: Tree, context: SchematicContext): Tree => {
    host.overwrite(
      'nx.json',
      serializeJson(callback(readJsonInTree(host, 'nx.json'), context))
    );
    return host;
  };
}

/**
 * Sets former nx.json options on projects which are already in workspace.json
 * @deprecated(v14) project options are no longer stored in nx.json, this should not be used.
 */
export function addProjectToNxJsonInTree(
  projectName: string,
  options: Pick<ProjectConfiguration, 'tags' | 'implicitDependencies'>
): Rule {
  return updateWorkspaceInTree((json: WorkspaceJsonConfiguration) => {
    const project =
      json.projects[projectName] ?? ({} as Partial<ProjectConfiguration>);
    project.tags = options.tags ?? project.tags ?? [];
    project.implicitDependencies =
      options.implicitDependencies ?? project.implicitDependencies;
    json.projects[projectName] = project as ProjectConfiguration;
    return json;
  });
}

export function readWorkspace(host: Tree): any {
  const path = getWorkspacePath(host);
  return readJsonInTree(host, path);
}

/**
 * verifies whether the given packageJson dependencies require an update
 * given the deps & devDeps passed in
 */
function requiresAddingOfPackages(packageJsonFile, deps, devDeps): boolean {
  let needsDepsUpdate = false;
  let needsDevDepsUpdate = false;

  packageJsonFile.dependencies = packageJsonFile.dependencies || {};
  packageJsonFile.devDependencies = packageJsonFile.devDependencies || {};

  if (Object.keys(deps).length > 0) {
    needsDepsUpdate = Object.keys(deps).some(
      (entry) => !packageJsonFile.dependencies[entry]
    );
  }

  if (Object.keys(devDeps).length > 0) {
    needsDevDepsUpdate = Object.keys(devDeps).some(
      (entry) => !packageJsonFile.devDependencies[entry]
    );
  }

  return needsDepsUpdate || needsDevDepsUpdate;
}

/**
 * Updates the package.json given the passed deps and/or devDeps. Only updates
 * if the packages are not yet present
 *
 * @param deps the package.json dependencies to add
 * @param devDeps the package.json devDependencies to add
 * @param addInstall default `true`; set to false to avoid installs
 */
export function addDepsToPackageJson(
  deps: any,
  devDeps: any,
  addInstall = true
): Rule {
  return (host: Tree, context: SchematicContext) => {
    const currentPackageJson = readJsonInTree(host, 'package.json');

    if (requiresAddingOfPackages(currentPackageJson, deps, devDeps)) {
      return chain([
        updateJsonInTree('package.json', (json, context: SchematicContext) => {
          json.dependencies = {
            ...(json.dependencies || {}),
            ...deps,
            ...(json.dependencies || {}),
          };
          json.devDependencies = {
            ...(json.devDependencies || {}),
            ...devDeps,
            ...(json.devDependencies || {}),
          };
          json.dependencies = sortObjectByKeys(json.dependencies);
          json.devDependencies = sortObjectByKeys(json.devDependencies);
          return json;
        }),
        addInstallTask({
          skipInstall: !addInstall,
        }),
      ]);
    } else {
      return noop();
    }
  };
}

export function updatePackageJsonDependencies(
  deps: any,
  devDeps: any,
  addInstall = true
): Rule {
  return chain([
    updateJsonInTree('package.json', (json, context: SchematicContext) => {
      json.dependencies = {
        ...(json.dependencies || {}),
        ...deps,
      };
      json.devDependencies = {
        ...(json.devDependencies || {}),
        ...devDeps,
      };
      json.dependencies = sortObjectByKeys(json.dependencies);
      json.devDependencies = sortObjectByKeys(json.devDependencies);
      return json;
    }),
    addInstallTask({
      skipInstall: !addInstall,
    }),
  ]);
}

export function getProjectConfig(host: Tree, name: string): any {
  const workspaceJson = readJsonInTree(host, getWorkspacePath(host));
  const projectConfig = workspaceJson.projects[name];

  if (!projectConfig) {
    throw new Error(`Cannot find project '${name}'`);
  } else if (typeof projectConfig === 'string') {
    return readJsonInTree(host, projectConfig);
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
  const relevantImports = allImports.filter((node) => {
    // StringLiteral of the ImportDeclaration is the import file (fileName in this case).
    const importFiles = node
      .getChildren()
      .filter((child) => child.kind === ts.SyntaxKind.StringLiteral)
      .map((n) => (n as ts.StringLiteral).text);

    return importFiles.filter((file) => file === fileName).length === 1;
  });

  if (relevantImports.length > 0) {
    let importsAsterisk = false;
    // imports from import file
    const imports: ts.Node[] = [];
    relevantImports.forEach((n) => {
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
      (n) => (n as ts.Identifier).text === symbolName
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
    ),
  ]);
}

export function renameSyncInTree(
  tree: Tree,
  from: string,
  to: string,
  cb: (err: string) => void
) {
  if (!tree.exists(from)) {
    cb(`Path: ${from} does not exist`);
  } else if (tree.exists(to)) {
    cb(`Path: ${to} already exists`);
  } else {
    renameFile(tree, from, to);
    cb(null);
  }
}

export function renameDirSyncInTree(
  tree: Tree,
  from: string,
  to: string,
  cb: (err: string) => void
) {
  const dir = tree.getDir(from);
  if (!dirExists(dir)) {
    cb(`Path: ${from} does not exist`);
    return;
  }
  dir.visit((path) => {
    const destination = path.replace(from, to);
    renameFile(tree, path, destination);
  });
  cb(null);
}

function dirExists(dir: DirEntry): boolean {
  return dir.subdirs.length + dir.subfiles.length !== 0;
}

function renameFile(tree: Tree, from: string, to: string) {
  const buffer = tree.read(from);
  if (!buffer) {
    return;
  }
  tree.create(to, buffer);
  tree.delete(from);
}

/**
 * Applies a template merge but skips for already existing entries
 */
export function applyWithSkipExisting(source: Source, rules: Rule[]): Rule {
  return (tree: Tree, _context: SchematicContext) => {
    const rule = mergeWith(
      apply(source, [
        ...rules,
        forEach((fileEntry) => {
          if (tree.exists(fileEntry.path)) {
            return null;
          }
          return fileEntry;
        }),
      ])
    );

    return rule(tree, _context);
  };
}
