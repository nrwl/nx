import { names, Tree } from '@nrwl/devkit';
import { insertImport } from '@nrwl/workspace/src/utilities/ast-utils';
import * as ts from 'typescript';
import {
  addImportToModule,
  addRoute,
} from '../../../utils/nx-devkit/ast-utils';
import { NormalizedSchema } from './normalized-schema';
import { addStandaloneRoute } from '../../../utils/nx-devkit/standalone-utils';

export function addChildren(
  tree: Tree,
  options: NormalizedSchema['libraryOptions']
) {
  if (!tree.exists(options.parentModule)) {
    throw new Error(`Cannot find '${options.parentModule}'`);
  }

  const moduleSource = tree.read(options.parentModule, 'utf-8');
  const constName = options.standalone
    ? `${names(options.name).className.toUpperCase()}_ROUTES`
    : `${names(options.fileName).propertyName}Routes`;
  const importPath = options.importPath;
  let sourceFile = ts.createSourceFile(
    options.parentModule,
    moduleSource,
    ts.ScriptTarget.Latest,
    true
  );

  if (!options.standalone) {
    sourceFile = addImportToModule(
      tree,
      sourceFile,
      options.parentModule,
      options.moduleName
    );
  }

  sourceFile = insertImport(
    tree,
    sourceFile,
    options.parentModule,
    options.standalone ? constName : `${options.moduleName}, ${constName}`,
    importPath
  );

  const route = `{ path: '${
    names(options.fileName).fileName
  }', children: ${constName} }`;

  if (moduleSource.includes('@NgModule')) {
    sourceFile = addRoute(tree, options.parentModule, sourceFile, route);
  } else {
    addStandaloneRoute(
      tree,
      options.parentModule,
      route,
      false,
      constName,
      importPath
    );
  }
}
