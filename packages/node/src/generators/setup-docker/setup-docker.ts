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
import { initGenerator as dockerInitGenerator } from '@nx/docker';
import { SetUpDockerOptions } from './schema';
import { join } from 'path';

function normalizeOptions(
  tree: Tree,
  setupOptions: SetUpDockerOptions
): SetUpDockerOptions {
  return {
    ...setupOptions,
    project: setupOptions.project ?? readNxJson(tree).defaultProject,
    targetName: setupOptions.targetName ?? 'docker:build',
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

async function addDocker(tree: Tree, options: SetUpDockerOptions) {
  const installTask = await dockerInitGenerator(tree, { skipFormat: true });
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

  return installTask;
}

export function updateProjectConfig(tree: Tree, options: SetUpDockerOptions) {
  let projectConfig = readProjectConfiguration(tree, options.project);

  projectConfig.targets[`${options.targetName}`] = {
    dependsOn: [`${options.buildTarget}`, 'prune'],
  };

  updateProjectConfiguration(tree, options.project, projectConfig);
}

export async function setupDockerGenerator(
  tree: Tree,
  setupOptions: SetUpDockerOptions
) {
  const tasks: GeneratorCallback[] = [];
  const options = normalizeOptions(tree, setupOptions);

  const installTask = await addDocker(tree, options);
  tasks.push(installTask);
  updateProjectConfig(tree, options);

  if (!options.skipFormat) {
    await formatFiles(tree);
  }

  return runTasksInSerial(...tasks);
}

export default setupDockerGenerator;
