import { names, Tree } from '@nrwl/devkit';
import * as ts from 'typescript';
import { NormalizedSchema } from './normalized-schema';
import { addRoute } from '../../../utils/nx-devkit/route-utils';

export function addLoadChildren(
  tree: Tree,
  options: NormalizedSchema['libraryOptions']
) {
  if (!tree.exists(options.parent)) {
    throw new Error(`Cannot find '${options.parent}'`);
  }

  const moduleSource = tree.read(options.parent, 'utf-8');
  const sourceFile = ts.createSourceFile(
    options.parent,
    moduleSource,
    ts.ScriptTarget.Latest,
    true
  );

  const route = `{path: '${
    names(options.fileName).fileName
  }', loadChildren: () => import('${options.importPath}').then(m => m.${
    options.standalone
      ? `${names(options.name).propertyName}Routes`
      : options.moduleName
  })}`;

  addRoute(tree, options.parent, route);
}
