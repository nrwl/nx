import { names, Tree } from '@nx/devkit';
import { NormalizedSchema } from './normalized-schema';
import { addRoute } from '../../../utils/nx-devkit/route-utils';

export function addLoadChildren(
  tree: Tree,
  options: NormalizedSchema['libraryOptions']
) {
  const { parent } = options;
  if (!parent || !tree.exists(parent)) {
    throw new Error(`Cannot find '${parent}'`);
  }
  const route = `{ path: '${
    names(options.fileName).fileName
  }', loadChildren: () => import('${options.importPath}').then(m => m.${
    options.standalone
      ? `${names(options.name).propertyName}Routes`
      : options.moduleName
  }) }`;

  addRoute(tree, parent, route);
}
