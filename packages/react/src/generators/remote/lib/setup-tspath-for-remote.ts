import type { Tree } from '@nx/devkit';
import { joinPathFragments, readProjectConfiguration } from '@nx/devkit';
import { addTsConfigPath } from '@nx/js';
import { maybeJs } from '../../../utils/maybe-js';
import type { Schema } from '../schema';

export function setupTspathForRemote(tree: Tree, options: Schema) {
  const project = readProjectConfiguration(tree, options.name);

  const exportPath = maybeJs(options, './src/remote-entry.ts');

  const exportName = 'Module';

  addTsConfigPath(tree, `${options.name}/${exportName}`, [
    joinPathFragments(project.root, exportPath),
  ]);
}
