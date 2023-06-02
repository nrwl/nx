import {
  addProjectConfiguration,
  ProjectConfiguration,
  Tree,
} from '@nx/devkit';
import { NormalizedSchema } from '../schema';

export function createProjectConfigurationInNewDestination(
  tree: Tree,
  schema: NormalizedSchema,
  projectConfig: ProjectConfiguration
) {
  projectConfig.name = schema.newProjectName;

  // Subtle bug if project name === path, where the updated name was being overrideen.
  const { name, ...rest } = projectConfig;

  // replace old root path with new one
  const projectString = JSON.stringify(rest);
  const newProjectString = projectString.replace(
    new RegExp(projectConfig.root, 'g'),
    schema.relativeToRootDestination
  );
  const newProject: ProjectConfiguration = {
    name,
    ...JSON.parse(newProjectString),
  };

  // Create a new project with the root replaced
  addProjectConfiguration(tree, schema.newProjectName, newProject);
}
