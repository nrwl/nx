import {
  Rule,
  Tree,
  externalSchematic,
  noop,
} from '@angular-devkit/schematics';

import { readJsonInTree } from '../ast-utils';

/**
 * Calls init _if_ the package does not already exist
 */
export function addPackageWithInit(
  packageName: string,
  testRunners: {
    unitTestRunner: 'jest' | 'none';
    e2eTestRunner?: 'cypress' | 'none';
  } = { unitTestRunner: 'jest', e2eTestRunner: 'cypress' }
): Rule {
  return (host: Tree) => {
    const { dependencies, devDependencies } = readJsonInTree(
      host,
      'package.json'
    );
    return dependencies[packageName] || devDependencies[packageName]
      ? noop()
      : externalSchematic(packageName, 'init', { ...testRunners });
  };
}
