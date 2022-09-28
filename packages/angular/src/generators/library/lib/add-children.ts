import { names, Tree } from '@nrwl/devkit';
import { insertImport } from '@nrwl/workspace/src/utilities/ast-utils';
import * as ts from 'typescript';
import { addImportToModule } from '../../../utils/nx-devkit/ast-utils';
import { NormalizedSchema } from './normalized-schema';
import { addRoute } from '../../../utils/nx-devkit/route-utils';

export function addChildren(
  tree: Tree,
  options: NormalizedSchema['libraryOptions']
) {
  if (!tree.exists(options.parent)) {
    throw new Error(`Cannot find '${options.parent}'`);
  }

  const routeFileSource = tree.read(options.parent, 'utf-8');
  const constName = options.standalone
    ? `${names(options.name).propertyName}Routes`
    : `${names(options.fileName).propertyName}Routes`;
  const importPath = options.importPath;
  let sourceFile = ts.createSourceFile(
    options.parent,
    routeFileSource,
    ts.ScriptTarget.Latest,
    true
  );

  if (!options.standalone) {
    sourceFile = addImportToModule(
      tree,
      sourceFile,
      options.parent,
      options.moduleName
    );
  }

  sourceFile = insertImport(
    tree,
    sourceFile,
    options.parent,
    options.standalone ? constName : `${options.moduleName}, ${constName}`,
    importPath
  );

  const route = `{ path: '${
    names(options.fileName).fileName
  }', children: ${constName} }`;

  addRoute(tree, options.parent, route, false, constName, importPath);
}
