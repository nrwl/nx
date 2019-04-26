import {
  Rule,
  Tree,
  externalSchematic,
  noop
} from '@angular-devkit/schematics';

import { readJsonInTree } from '../ast-utils';

/**
 * Calls ng-add _if_ the package does not already exist
 */
export function addPackageWithNgAdd(packageName: string): Rule {
  return (host: Tree) => {
    const { dependencies, devDependencies } = readJsonInTree(
      host,
      'package.json'
    );
    return dependencies[packageName] || devDependencies[packageName]
      ? noop()
      : externalSchematic(packageName, 'ng-add', {});
  };
}
