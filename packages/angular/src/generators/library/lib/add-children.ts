import { names, Tree } from '@nx/devkit';
import { insertImport } from '@nx/js';
import { addImportToModule } from '../../../utils/nx-devkit/ast-utils';
import { NormalizedSchema } from './normalized-schema';
import { addRoute } from '../../../utils/nx-devkit/route-utils';
import { ensureTypescript } from '@nx/js/internal';

let tsModule: typeof import('typescript');

export function addChildren(
  tree: Tree,
  options: NormalizedSchema['libraryOptions']
) {
  const { parent } = options;
  if (!parent) {
    throw new Error(`Cannot find '${parent}'`);
  }
  const routeFileSource = tree.read(parent, 'utf-8');
  if (routeFileSource === null) {
    throw new Error(`Cannot find '${parent}'`);
  }
  if (!tsModule) {
    tsModule = ensureTypescript();
  }

  const constName = options.standalone
    ? `${names(options.name).propertyName}Routes`
    : `${names(options.fileName).propertyName}Routes`;
  const importPath = options.importPath;
  let sourceFile = tsModule.createSourceFile(
    parent,
    routeFileSource,
    tsModule.ScriptTarget.Latest,
    true
  );

  if (!options.standalone) {
    sourceFile = addImportToModule(
      tree,
      sourceFile,
      parent,
      options.moduleName
    );
  }

  sourceFile = insertImport(
    tree,
    sourceFile,
    parent,
    options.standalone ? constName : `${options.moduleName}, ${constName}`,
    importPath
  );

  const route = `{ path: '${
    names(options.fileName).fileName
  }', children: ${constName} }`;

  addRoute(tree, parent, route, false, constName, importPath);
}
