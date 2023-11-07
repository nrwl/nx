import type { Tree } from '@nx/devkit';
import type { Schema } from '../schema';
import { joinPathFragments, readProjectConfiguration } from '@nx/devkit';
import { addTsConfigPath } from '@nx/js';

export function setupTspathForRemote(tree: Tree, options: Schema) {
  const project = readProjectConfiguration(tree, options.name);

  const exportPath = `./src/remote-entry.${options.js ? 'js' : 'ts'}`;

  const exportName = 'Module';

  addTsConfigPath(tree, `${options.name}/${exportName}`, [
    joinPathFragments(project.root, exportPath),
  ]);
}
