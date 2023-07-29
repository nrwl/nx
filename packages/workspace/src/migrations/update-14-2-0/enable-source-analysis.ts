import { formatFiles, NxJsonConfiguration, Tree, updateJson } from '@nx/devkit';

export async function enableSourceAnalysis(tree: Tree) {
  updateJson<NxJsonConfiguration>(tree, 'nx.json', (config) => {
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
    return config;
  });
  await formatFiles(tree);
}

export default enableSourceAnalysis;
