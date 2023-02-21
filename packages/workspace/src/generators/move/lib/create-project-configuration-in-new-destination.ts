import {
  addProjectConfiguration,
  ProjectConfiguration,
  Tree,
} from '@nrwl/devkit';
import { NormalizedSchema } from '../schema';

export function createProjectConfigurationInNewDestination(
  tree: Tree,
  schema: NormalizedSchema,
  projectConfig: ProjectConfiguration
) {
  if (projectConfig.name) {
    projectConfig.name = schema.newProjectName;
  }

  // replace old root path with new one
  const projectString = JSON.stringify(projectConfig);
  const newProjectString = projectString.replace(
    new RegExp(projectConfig.root, 'g'),
    schema.relativeToRootDestination
  );
  const newProject: ProjectConfiguration = JSON.parse(newProjectString);

  // Create a new project with the root replaced
  addProjectConfiguration(tree, schema.newProjectName, newProject);
}
