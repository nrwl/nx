import { ProjectConfiguration, Tree } from '@nrwl/devkit';
import { appRootPath } from 'nx/src/utils/app-root';
import * as path from 'path';
import { join } from 'path';
import { NormalizedSchema } from '../schema';

/**
 * Updates relative path to root storybook config for `main.js` & `webpack.config.js`
 *
 * @param schema The options provided to the schematic
 */
export function updateStorybookConfig(
  tree: Tree,
  schema: NormalizedSchema,
  project: ProjectConfiguration
) {
  const oldRelativeRoot = path
    .relative(path.join(appRootPath, `${project.root}/.storybook`), appRootPath)
    .split(path.sep)
    .join('/');
  const newRelativeRoot = path
    .relative(
      path.join(appRootPath, `${schema.relativeToRootDestination}/.storybook`),
      appRootPath
    )
    .split(path.sep)
    .join('/');

  const storybookDir = path.join(
    schema.relativeToRootDestination,
    '.storybook'
  );

  if (!storybookDir) {
    return;
  }

  // Replace relative import path to root storybook folder for each file under project storybook
  for (const file of tree.children(storybookDir)) {
    const oldContent = tree.read(join(storybookDir, file), 'utf-8');
    const newContent = oldContent.replace(oldRelativeRoot, newRelativeRoot);

    tree.write(join(storybookDir, file), newContent);
  }
}
