import { Tree, getProjects, joinPathFragments } from '@nx/devkit';

import { ensureTypescript } from '@nx/js/src/utils/typescript/ensure-typescript';
import type {
  SourceFile,
  ObjectLiteralExpression,
  Node,
  PropertyAssignment,
  TransformerFactory,
  Visitor,
} from 'typescript';

let tsModule: typeof import('typescript');

if (!tsModule) {
  tsModule = ensureTypescript();
}

/**
 * Adds a Module Federation path to the exposes property of the module federation config
 * The assumption here is made the we will only update a TypeScript Module Federation file namely 'module-federation.config.js'
 * @param tree Tree for the workspace
 * @param projectPath Project path relative to the workspace
 * @param moduleName The name of the module to expose
 * @param modulePath The path to the module to expose (e.g. './src/my-lib/my-lib.ts')
 */
export function addPathToExposes(
  tree: Tree,
  projectPath: string,
  moduleName: string,
  modulePath: string
) {
  const moduleFederationConfigPath = joinPathFragments(
    projectPath,
    tree.exists(joinPathFragments(projectPath, 'module-federation.config.ts'))
      ? 'module-federation.config.ts'
      : 'module-federation.config.js'
  );

  updateExposesProperty(
    tree,
    moduleFederationConfigPath,
    moduleName,
    modulePath
  );
}

/**
 * @param tree The workspace tree
 * @param remoteName The name of the remote to check
 * @returns Remote ProjectConfig if it exists, false otherwise
 */
export function checkRemoteExists(tree: Tree, remoteName: string) {
  const remote = getRemote(tree, remoteName);
  if (!remote) return false;
  const hasModuleFederationConfig =
    tree.exists(
      joinPathFragments(remote.root, 'module-federation.config.js')
    ) ||
    tree.exists(joinPathFragments(remote.root, 'module-federation.config.ts'));

  return hasModuleFederationConfig ? remote : false;
}

export function getRemote(tree: Tree, remoteName: string) {
  const projects = getProjects(tree);
  const remote = projects.get(remoteName);
  return remote;
}

// Check if the exposes property exists in the AST
export function findExposes(sourceFile: SourceFile) {
  let exposesObject: ObjectLiteralExpression | null = null;

  const visit = (node: Node) => {
    if (
      tsModule.isPropertyAssignment(node) &&
      tsModule.isIdentifier(node.name) &&
      node.name.text === 'exposes' &&
      tsModule.isObjectLiteralExpression(node.initializer)
    ) {
      exposesObject = node.initializer;
    } else {
      tsModule.forEachChild(node, visit);
    }
  };

  tsModule.forEachChild(sourceFile, visit);

  return exposesObject;
}

// Create a new property assignment
export function createObjectEntry(
  moduleName: string,
  modulePath: string
): PropertyAssignment {
  return tsModule.factory.createPropertyAssignment(
    tsModule.factory.createStringLiteral(`./${moduleName}`, true),
    tsModule.factory.createStringLiteral(modulePath, true)
  );
}

// Update the exposes property in the AST
export function updateExposesPropertyinAST(
  source: SourceFile,
  exposesObject: ObjectLiteralExpression,
  newEntry: PropertyAssignment
) {
  const updatedExposes = tsModule.factory.updateObjectLiteralExpression(
    exposesObject,
    [...exposesObject.properties, newEntry]
  );

  const transform: TransformerFactory<SourceFile> = (context) => {
    const visit: Visitor = (node) => {
      // Comparing nodes indirectly to ensure type compatibility. You must ensure that the nodes are identical.
      return tsModule.isObjectLiteralExpression(node) && node === exposesObject
        ? updatedExposes
        : tsModule.visitEachChild(node, visit, context);
    };
    return (node) => tsModule.visitNode(node, visit) as SourceFile;
  };

  return tsModule.transform<SourceFile>(source, [transform]).transformed[0];
}

// Write the updated AST to the file (module-federation.config.js)
export function writeToConfig(
  tree: Tree,
  filename: string,
  source: SourceFile,
  updatedSourceFile: SourceFile
) {
  const printer = tsModule.createPrinter();
  const update = printer.printNode(
    tsModule.EmitHint.Unspecified,
    updatedSourceFile,
    source
  );
  tree.write(filename, update);
}

export function updateExposesProperty(
  tree: Tree,
  filename: string,
  moduleName: string,
  modulePath: string
) {
  const fileContent = tree.read(filename).toString();
  const source = tsModule.createSourceFile(
    filename,
    fileContent,
    tsModule.ScriptTarget.ES2015,
    true
  );

  const exposesObject = findExposes(source);
  if (!exposesObject) return;

  const newEntry = createObjectEntry(moduleName, modulePath);
  const updatedSourceFile = updateExposesPropertyinAST(
    source,
    exposesObject,
    newEntry
  );
  writeToConfig(tree, filename, source, updatedSourceFile);
}
