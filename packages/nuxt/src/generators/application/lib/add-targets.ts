import {
  Tree,
  joinPathFragments,
  readProjectConfiguration,
  updateProjectConfiguration,
} from '@nx/devkit';

export function addServeTarget(
  tree: Tree,
  projectName: string,
  projectRoot: string
) {
  const projectConfig = readProjectConfiguration(tree, projectName);
  projectConfig.targets['serve'] = {
    executor: 'nx:run-commands',
    outputs: [
      '{workspaceRoot}/{projectRoot}/.output',
      '{workspaceRoot}/{projectRoot}/.nuxt',
    ],
    options: {
      command: 'npx nuxi dev --port=4200',
      cwd: joinPathFragments(projectRoot),
    },
  };
  updateProjectConfiguration(tree, projectName, projectConfig);
}

export function addBuildTarget(
  tree: Tree,
  projectName: string,
  projectRoot: string
) {
  const projectConfig = readProjectConfiguration(tree, projectName);
  projectConfig.targets['build'] = {
    executor: 'nx:run-commands',
    outputs: [
      '{workspaceRoot}/{projectRoot}/.output',
      '{workspaceRoot}/{projectRoot}/.nuxt',
    ],
    options: {
      command: 'npx nuxi build',
      cwd: joinPathFragments(projectRoot),
    },
  };
  updateProjectConfiguration(tree, projectName, projectConfig);
}
