import type {
  Node,
  ObjectLiteralExpression,
  PropertyAssignment,
  SourceFile,
  TransformerFactory,
  Visitor,
} from 'typescript';
import { joinPathFragments, type Tree } from '@nx/devkit';
import { ensureTypescript } from '@nx/js/src/utils/typescript/ensure-typescript';

let tsModule: typeof import('typescript');

type AddPathToExposesOptions = {
  projectPath: string;
  moduleName: string;
  modulePath: string;
};

export function addPathToExposes(
  tree: Tree,
  { projectPath, moduleName, modulePath }: AddPathToExposesOptions
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

function updateExposesProperty(
  tree: Tree,
  moduleFederationConfigPath: string,
  moduleName: string,
  modulePath: string
) {
  if (!tsModule) {
    tsModule = ensureTypescript();
  }

  const fileContent = tree.read(moduleFederationConfigPath, 'utf-8');
  const source = tsModule.createSourceFile(
    moduleFederationConfigPath,
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
  writeToConfig(tree, moduleFederationConfigPath, source, updatedSourceFile);
}

function findExposes(sourceFile: SourceFile) {
  if (!tsModule) {
    tsModule = ensureTypescript();
  }

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
function createObjectEntry(
  moduleName: string,
  modulePath: string
): PropertyAssignment {
  if (!tsModule) {
    tsModule = ensureTypescript();
  }

  return tsModule.factory.createPropertyAssignment(
    tsModule.factory.createStringLiteral(`./${moduleName}`, true),
    tsModule.factory.createStringLiteral(modulePath, true)
  );
}

// Update the exposes property in the AST
function updateExposesPropertyinAST(
  source: SourceFile,
  exposesObject: ObjectLiteralExpression,
  newEntry: PropertyAssignment
) {
  if (!tsModule) {
    tsModule = ensureTypescript();
  }

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
function writeToConfig(
  tree: Tree,
  filename: string,
  source: SourceFile,
  updatedSourceFile: SourceFile
) {
  if (!tsModule) {
    tsModule = ensureTypescript();
  }

  const printer = tsModule.createPrinter();
  const update = printer.printNode(
    tsModule.EmitHint.Unspecified,
    updatedSourceFile,
    source
  );
  tree.write(filename, update);
}
