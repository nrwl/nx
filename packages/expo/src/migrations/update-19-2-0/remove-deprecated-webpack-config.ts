import { Tree, getProjects } from '@nx/devkit';
import { removeSync } from 'fs-extra';
import { join } from 'path';

/**
 * This function removes the deprecated webpack.config.js file from projects that use the expo:start executor
 * @param tree
 */
export default async function update(tree: Tree) {
  const projects = getProjects(tree);

  for (const [_, config] of projects.entries()) {
    if (config.targets?.['start']?.executor === '@nx/expo:start') {
      if (tree.exists(join(config.root, 'webpack.config.js'))) {
        tree.delete(join(config.root, 'webpack.config.js'));
      }
    }
  }
}
