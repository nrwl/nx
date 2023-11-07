import {
  Tree,
  readProjectConfiguration,
  updateProjectConfiguration,
} from '@nx/devkit';

export function addServeTarget(tree: Tree, projectName: string) {
  const projectConfig = readProjectConfiguration(tree, projectName);
  projectConfig.targets['serve'] = {
    executor: '@nx/nuxt:serve',
    outputs: ['{options.outputFile}'],
    options: {},
  };
  updateProjectConfiguration(tree, projectName, projectConfig);
}

export function addBuildTarget(
  tree: Tree,
  projectName: string,
  outputPath: string
) {
  const projectConfig = readProjectConfiguration(tree, projectName);
  projectConfig.targets['build'] = {
    executor: '@nx/nuxt:build',
    outputs: ['{options.outputFile}'],
    options: {
      outputPath: outputPath,
    },
  };
  updateProjectConfiguration(tree, projectName, projectConfig);
}
