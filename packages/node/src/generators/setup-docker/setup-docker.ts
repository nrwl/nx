import {
  convertNxGenerator,
  formatFiles,
  generateFiles,
  GeneratorCallback,
  joinPathFragments,
  logger,
  readNxJson,
  readProjectConfiguration,
  runTasksInSerial,
  Tree,
  updateProjectConfiguration,
} from '@nx/devkit';

import { SetUpDockerOptions } from './schema';

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

function addDocker(tree: Tree, options: SetUpDockerOptions) {
  const project = readProjectConfiguration(tree, options.project);
  if (!project || !options.targetName) {
    return;
  }

  if (tree.exists(joinPathFragments(project.root, 'DockerFile'))) {
    logger.info(
      `Skipping setup since a Dockerfile already exists inside ${project.root}`
    );
  } else {
    const outputPath =
      project.targets[`${options.buildTarget}`]?.options.outputPath;
    generateFiles(tree, joinPathFragments(__dirname, './files'), project.root, {
      tmpl: '',
      app: project.sourceRoot,
      buildLocation: outputPath,
      project: options.project,
    });
  }
}

export function updateProjectConfig(tree: Tree, options: SetUpDockerOptions) {
  let projectConfig = readProjectConfiguration(tree, options.project);

  projectConfig.targets[`${options.targetName}`] = {
    dependsOn: [`${options.buildTarget}`],
    command: `docker build -f ${joinPathFragments(
      projectConfig.root,
      'Dockerfile'
    )} . -t ${options.project}`,
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
export const setupDockerSchematic = convertNxGenerator(setupDockerGenerator);
