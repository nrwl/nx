import { Tree, ProjectConfiguration, getWorkspaceLayout } from '@nrwl/devkit';

import * as path from 'path';

import { Schema } from '../schema';
import { getDestination, getNewProjectName } from './utils';

/**
 * Updates the project name and coverage folder in the jest.config.js if it exists
 *
 * (assume relative paths have been updated previously)
 *
 * @param schema The options provided to the schematic
 */
export function updateJestConfig(
  tree: Tree,
  schema: Schema,
  project: ProjectConfiguration
) {
  const destination = getDestination(tree, schema, project);
  const newProjectName = getNewProjectName(schema.destination);

  const jestConfigPath = path.join(destination, 'jest.config.js');

  if (!tree.exists(jestConfigPath)) {
    // nothing to do
    return;
  }

  const oldContent = tree.read(jestConfigPath).toString('utf-8');

  const findName = new RegExp(`'${schema.projectName}'`, 'g');
  const findDir = new RegExp(project.root, 'g');

  const newContent = oldContent
    .replace(findName, `'${newProjectName}'`)
    .replace(findDir, destination);
  tree.write(jestConfigPath, newContent);

  // update root jest.config.js
  const rootJestConfigPath = '/jest.config.js';

  if (!tree.exists(rootJestConfigPath)) {
    return;
  }

  const { libsDir, appsDir } = getWorkspaceLayout(tree);
  const findProject = new RegExp(
    `<rootDir>\/(${libsDir}|${appsDir})\/${schema.projectName}`,
    'g'
  );

  const oldRootJestConfigContent = tree
    .read(rootJestConfigPath)
    .toString('utf-8');

  const newRootJestConfigContent = oldRootJestConfigContent.replace(
    findProject,
    `<rootDir>/${destination}`
  );

  tree.write(rootJestConfigPath, newRootJestConfigContent);
}
