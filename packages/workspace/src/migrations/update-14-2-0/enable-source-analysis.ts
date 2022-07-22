import {
  formatFiles,
  readWorkspaceConfiguration,
  Tree,
  updateWorkspaceConfiguration,
} from '@nrwl/devkit';

export async function enableSourceAnalysis(tree: Tree) {
  const config = readWorkspaceConfiguration(tree);
  if (
    config.extends === 'nx/presets/core.json' ||
    config.extends === 'nx/presets/npm.json'
  ) {
    const explicitlyDisabled =
      config.pluginsConfig &&
      config.pluginsConfig['@nrwl/js'] &&
      (config.pluginsConfig['@nrwl/js'] as any).analyzeSourceFiles === false;

    if (!explicitlyDisabled) {
      config.pluginsConfig ||= {};
      config.pluginsConfig['@nrwl/js'] ||= {};
      (config.pluginsConfig['@nrwl/js'] as any).analyzeSourceFiles = true;
    }
  }
  updateWorkspaceConfiguration(tree, config);
  await formatFiles(tree);
}

export default enableSourceAnalysis;
