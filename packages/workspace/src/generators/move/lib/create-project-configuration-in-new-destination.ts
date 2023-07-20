import {
  addProjectConfiguration,
  joinPathFragments,
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
  const isRootProject = projectConfig.root === '.';

  // Subtle bug if project name === path, where the updated name was being overrideen.
  const { name, ...rest } = projectConfig;

  // replace old root path with new one
  let newProjectString = JSON.stringify(rest);
  if (isRootProject) {
    // Don't replace . with new root since it'll match all characters.
    // Only look for "./" and replace with new root.
    newProjectString = newProjectString.replace(
      /\.\//g,
      schema.relativeToRootDestination + '/'
    );
    newProjectString = newProjectString.replace(
      /"(tsconfig\..*\.json)"/g,
      `"${schema.relativeToRootDestination}/$1"`
    );
    newProjectString = newProjectString.replace(
      /"(webpack\..*\.[jt]s)"/g,
      `"${schema.relativeToRootDestination}/$1"`
    );
    newProjectString = newProjectString.replace(
      /"(vite\..*\.[jt]s)"/g,
      `"${schema.relativeToRootDestination}/$1"`
    );
    newProjectString = newProjectString.replace(
      /"(\.\/)?src\/([^"]+)"/g,
      `"${schema.relativeToRootDestination}/src/$1"`
    );
  } else {
    newProjectString = newProjectString.replace(
      new RegExp(projectConfig.root, 'g'),
      schema.relativeToRootDestination
    );
  }
  const newProject: ProjectConfiguration = {
    name,
    ...JSON.parse(newProjectString),
  };

  newProject.root = schema.relativeToRootDestination;

  // Original sourceRoot is typically 'src' or 'app', but it could be any folder.
  // Make sure it is updated to be under the new destination.
  if (isRootProject && projectConfig.sourceRoot) {
    newProject.sourceRoot = joinPathFragments(
      schema.relativeToRootDestination,
      projectConfig.sourceRoot
    );
  }

  // Create a new project with the root replaced
  addProjectConfiguration(tree, schema.newProjectName, newProject);
}
