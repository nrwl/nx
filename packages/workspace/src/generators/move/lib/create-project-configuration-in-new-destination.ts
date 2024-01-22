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

  // Subtle bug if project name === path, where the updated name was being overridden.
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
      /"((tsconfig|jest|webpack|vite)\..*?\.(ts|js|json))"/g,
      `"${schema.relativeToRootDestination}/$1"`
    );
    newProjectString = newProjectString.replace(
      /"(\.\/)?src\/(.*?)"/g,
      `"${schema.relativeToRootDestination}/src/$2"`
    );
  } else {
    // There's another issue if project name === path, where the target
    // string (my-app:build:production) was being replaced
    // and resulting in my-destination/my-new-name:build:production

    // Change anything but target strings (my-app:build:production).
    // Target string are going to be updated in the updateBuildTargets function
    newProjectString = newProjectString.replace(
      new RegExp(projectConfig.root + '(?!:)', 'g'),
      schema.relativeToRootDestination
    );
  }

  const newProject: ProjectConfiguration = {
    name,
    ...JSON.parse(newProjectString),
  };

  newProject.root = schema.relativeToRootDestination;

  // Correct "e2e" target and config since part of the rename will be wrong unless we make the project name "e2e" more unique.
  // e.g. my-app-e2e is safer to search and replace than "e2e".
  if (projectConfig.name === 'e2e') {
    for (const [targetName, targetConfig] of Object.entries(
      newProject.targets
    )) {
      const wrongName = schema.relativeToRootDestination;
      if (targetName !== wrongName) continue;

      if (targetConfig.options?.testingType === wrongName) {
        targetConfig.options.testingType = 'e2e';
      }

      newProject.targets['e2e'] = targetConfig;
      delete newProject.targets[targetName];
    }
  }

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
