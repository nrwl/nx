import {
  formatFiles,
  generateFiles,
  GeneratorCallback,
  joinPathFragments,
  readNxJson,
  readProjectConfiguration,
  runTasksInSerial,
  Tree,
  updateProjectConfiguration,
} from '@nx/devkit';

import { SetUpDockerOptions } from './schema';
import { join } from 'path';

function normalizeOptions(
  tree: Tree,
  setupOptions: SetUpDockerOptions
): SetUpDockerOptions {
  return {
    ...setupOptions,
    project: setupOptions.project ?? readNxJson(tree).defaultProject,
    targetName: setupOptions.targetName ?? 'docker-build',
    buildTarget: setupOptions.buildTarget ?? 'build',
  };
}

function sanitizeProjectName(projectName: string): string {
  return projectName
    .toLowerCase()
    .replace(/[@\/]/g, '-')
    .replace(/[^a-z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function addDocker(tree: Tree, options: SetUpDockerOptions) {
  const projectConfig = readProjectConfiguration(tree, options.project);

  const outputPath =
    projectConfig.targets[options.buildTarget]?.options['outputPath'];

  if (!projectConfig) {
    throw new Error(`Cannot find project configuration for ${options.project}`);
  }

  if (!outputPath && !options.outputPath) {
    throw new Error(
      `The output path for the project ${options.project} is not defined. Please provide it as an option to the generator.`
    );
  }

  const sanitizedProjectName = sanitizeProjectName(options.project);

  generateFiles(tree, join(__dirname, './files'), projectConfig.root, {
    tmpl: '',
    buildLocation: options.outputPath ?? outputPath,
    project: options.project,
    projectPath: projectConfig.root,
    sanitizedProjectName,
  });
}

export function updateProjectConfig(tree: Tree, options: SetUpDockerOptions) {
  let projectConfig = readProjectConfiguration(tree, options.project);

  // Use sanitized project name for Docker image tag
  const sanitizedProjectName = sanitizeProjectName(options.project);

  projectConfig.targets[`${options.targetName}`] = {
    dependsOn: [`${options.buildTarget}`],
    command: `docker build -f ${joinPathFragments(
      projectConfig.root,
      'Dockerfile'
    )} . -t ${sanitizedProjectName}`,
  };

  updateProjectConfiguration(tree, options.project, projectConfig);
}

export async function setupDockerGenerator(
  tree: Tree,
  setupOptions: SetUpDockerOptions
) {
  const tasks: GeneratorCallback[] = [];
  const options = normalizeOptions(tree, setupOptions);
  // Should check if the node project exists
  addDocker(tree, options);
  updateProjectConfig(tree, options);

  if (!options.skipFormat) {
    await formatFiles(tree);
  }

  return runTasksInSerial(...tasks);
}

export default setupDockerGenerator;
