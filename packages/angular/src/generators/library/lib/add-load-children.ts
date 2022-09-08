import { names, Tree } from '@nrwl/devkit';
import * as ts from 'typescript';
import { addRoute } from '../../../utils/nx-devkit/ast-utils';
import { NormalizedSchema } from './normalized-schema';
import { addStandaloneRoute } from '../../../utils/nx-devkit/standalone-utils';

export function addLoadChildren(
  tree: Tree,
  options: NormalizedSchema['libraryOptions']
) {
  if (!tree.exists(options.parentModule)) {
    throw new Error(`Cannot find '${options.parentModule}'`);
  }

  const moduleSource = tree.read(options.parentModule)!.toString('utf-8');
  const sourceFile = ts.createSourceFile(
    options.parentModule,
    moduleSource,
    ts.ScriptTarget.Latest,
    true
  );

  const route = `{path: '${
    names(options.fileName).fileName
  }', loadChildren: () => import('${options.importPath}').then(m => m.${
    options.standalone
      ? `${names(options.name).className.toUpperCase()}_ROUTES`
      : options.moduleName
  })}`;

  if (moduleSource.includes('@NgModule')) {
    addRoute(tree, options.parentModule, sourceFile, route);
  } else {
    addStandaloneRoute(tree, options.parentModule, route);
  }
}
