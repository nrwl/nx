import { ProjectConfiguration, Tree } from '@nrwl/devkit';

import * as path from 'path';

import { appRootPath } from '../../../utilities/app-root';
import { Schema } from '../schema';
import { getDestination } from './utils';
import { join } from 'path';

/**
 * Updates relative path to root storybook config for `main.js` & `webpack.config.js`
 *
 * @param schema The options provided to the schematic
 */
export function updateStorybookConfig(
  tree: Tree,
  schema: Schema,
  project: ProjectConfiguration
) {
  const destination = getDestination(tree, schema, project);

  const oldRelativeRoot = path
    .relative(path.join(appRootPath, `${project.root}/.storybook`), appRootPath)
    .split(path.sep)
    .join('/');
  const newRelativeRoot = path
    .relative(path.join(appRootPath, `${destination}/.storybook`), appRootPath)
    .split(path.sep)
    .join('/');

  const storybookDir = path.join(destination, '.storybook');

  if (!storybookDir) {
    return;
  }

  // Replace relative import path to root storybook folder for each file under project storybook
  for (const file of tree.children(storybookDir)) {
    const oldContent = tree.read(join(storybookDir, file)).toString('utf-8');
    const newContent = oldContent.replace(oldRelativeRoot, newRelativeRoot);

    tree.write(join(storybookDir, file), newContent);
  }
}
