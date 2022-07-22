import { ProjectConfiguration, Tree } from '@nrwl/devkit';
import { workspaceRoot } from '@nrwl/devkit';
import * as path from 'path';
import { join } from 'path';
import { NormalizedSchema } from '../schema';

/**
 * Updates relative path to root storybook config for `main.js` & `webpack.config.js`
 *
 * @param {Tree} tree
 * @param {NormalizedSchema} schema The options provided to the schematic
 * @param {ProjectConfiguration} project
 */
export function updateStorybookConfig(
  tree: Tree,
  schema: NormalizedSchema,
  project: ProjectConfiguration
) {
  const oldRelativeRoot = path
    .relative(
      path.join(workspaceRoot, `${project.root}/.storybook`),
      workspaceRoot
    )
    .split(path.sep)
    .join('/');
  const newRelativeRoot = path
    .relative(
      path.join(
        workspaceRoot,
        `${schema.relativeToRootDestination}/.storybook`
      ),
      workspaceRoot
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
  updateRecursively(tree, storybookDir, oldRelativeRoot, newRelativeRoot);
}

function updateRecursively(
  tree: Tree,
  dir: string,
  oldRoot: string,
  newRoot: string
) {
  for (const child of tree.children(dir)) {
    const childPath = join(dir, child);

    if (tree.isFile(childPath)) {
      const oldContent = tree.read(childPath, 'utf-8');
      const newContent = oldContent.replace(oldRoot, newRoot);
      tree.write(childPath, newContent);
    } else {
      updateRecursively(tree, childPath, oldRoot, newRoot);
    }
  }
}
