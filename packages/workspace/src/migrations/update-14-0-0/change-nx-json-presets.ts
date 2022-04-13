import {
  formatFiles,
  readWorkspaceConfiguration,
  Tree,
  updateWorkspaceConfiguration,
} from '@nrwl/devkit';

export async function changeNxJsonPresets(tree: Tree) {
  const workspaceConfig = readWorkspaceConfiguration(tree);
  const replacements = {
    '@nrwl/workspace/presets/npm.json': 'nx/presets/npm.json',
    '@nrwl/workspace/presets/core.json': 'nx/presets/core.json',
  };
  if (workspaceConfig.extends && replacements[workspaceConfig.extends]) {
    updateWorkspaceConfiguration(tree, {
      ...workspaceConfig,
      extends: replacements[workspaceConfig.extends],
    });
  }

  await formatFiles(tree);
}

export default changeNxJsonPresets;
