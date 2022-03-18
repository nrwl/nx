import { Tree } from '@nrwl/devkit';
import { migrateFromAngularCli } from './migrate-from-angular-cli';
import { angularInitGenerator } from '../init/init';
import { Schema } from './schema';

function getWorkspaceType(tree: Tree): 'angular' | 'nx' {
  return tree.exists('nx.json') ? 'nx' : 'angular';
}

export async function ngAddGenerator(tree: Tree, options: Schema) {
  if (getWorkspaceType(tree) === 'angular') {
    return await migrateFromAngularCli(tree, options);
  }

  return angularInitGenerator(tree, options);
}

export default ngAddGenerator;
