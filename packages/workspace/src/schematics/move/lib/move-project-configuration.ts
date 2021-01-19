import {
  addProjectConfiguration,
  removeProjectConfiguration,
  NxJsonProjectConfiguration,
  ProjectConfiguration,
  Tree,
} from '@nrwl/devkit';

import { Schema } from '../schema';
import { getDestination, getNewProjectName } from './utils';

export function moveProjectConfiguration(
  tree: Tree,
  schema: Schema,
  projectConfig: ProjectConfiguration & NxJsonProjectConfiguration
) {
  let destination = getDestination(tree, schema, projectConfig);
  const projectString = JSON.stringify(projectConfig);
  const newProjectString = projectString.replace(
    new RegExp(projectConfig.root, 'g'),
    destination
  );

  // rename
  const newProject: ProjectConfiguration = JSON.parse(newProjectString);

  // Delete the original project
  removeProjectConfiguration(tree, schema.projectName);

  // Create a new project with the root replaced
  addProjectConfiguration(
    tree,
    getNewProjectName(schema.destination),
    newProject
  );
}
