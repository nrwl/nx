import type { Tree } from '@nrwl/devkit';
import { angularInitGenerator } from '../init/init';
import { migrateFromAngularCli } from './migrate-from-angular-cli';
import type { GeneratorOptions } from './schema';

function getWorkspaceType(tree: Tree): 'angular' | 'nx' {
  return tree.exists('nx.json') ? 'nx' : 'angular';
}

export async function ngAddGenerator(tree: Tree, options: GeneratorOptions) {
  if (getWorkspaceType(tree) === 'angular') {
    return await migrateFromAngularCli(tree, options);
  }

  return await angularInitGenerator(tree, options);
}

export default ngAddGenerator;
