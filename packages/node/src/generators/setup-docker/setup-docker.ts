import {
  formatFiles,
  generateFiles,
  GeneratorCallback,
  readNxJson,
  readProjectConfiguration,
  runTasksInSerial,
  Tree,
  updateProjectConfiguration,
} from '@nx/devkit';
import { initGenerator as dockerInitGenerator } from '@nx/docker/generators';
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
    skipDockerPlugin: setupOptions.skipDockerPlugin ?? false,
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
  let installTask = () => {};
  if (!options.skipDockerPlugin) {
    installTask = await dockerInitGenerator(tree, { skipFormat: true });
  }
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
  const finalOutputPath = options.outputPath ?? outputPath;

  // Calculate build location based on skipDockerPlugin flag
  let buildLocation: string;
  if (options.skipDockerPlugin) {
    // Legacy mode: use workspace-relative paths
    buildLocation = finalOutputPath;
  } else {
    // New mode: use project-relative paths
    // Remove the project root prefix from the output path
    const projectRootWithSlash = projectConfig.root + '/';
    buildLocation = finalOutputPath.startsWith(projectRootWithSlash)
      ? finalOutputPath.substring(projectRootWithSlash.length)
      : finalOutputPath.startsWith(projectConfig.root)
      ? finalOutputPath.substring(projectConfig.root.length)
      : 'dist';
  }

  generateFiles(tree, join(__dirname, './files'), projectConfig.root, {
    tmpl: '',
    buildLocation,
    project: options.project,
    projectPath: projectConfig.root,
    sanitizedProjectName,
    skipDockerPlugin: options.skipDockerPlugin,
  });

  return installTask;
}

export function updateProjectConfig(tree: Tree, options: SetUpDockerOptions) {
  let projectConfig = readProjectConfiguration(tree, options.project);

  if (options.skipDockerPlugin) {
    // Use sanitized project name for Docker image tag
    const sanitizedProjectName = sanitizeProjectName(options.project);

    projectConfig.targets[`${options.targetName}`] = {
      dependsOn: [`${options.buildTarget}`, 'prune'],
      command: `docker build . -t ${sanitizedProjectName}`,
      options: {
        cwd: projectConfig.root,
      },
    };
  } else {
    projectConfig.targets[`${options.targetName}`] = {
      dependsOn: [`${options.buildTarget}`, 'prune'],
    };
  }

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
