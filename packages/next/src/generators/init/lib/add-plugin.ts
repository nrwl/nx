import { Tree, readNxJson, updateNxJson } from '@nx/devkit';

export function addPlugin(tree: Tree) {
  const nxJson = readNxJson(tree);
  nxJson.plugins ??= [];

  for (const plugin of nxJson.plugins) {
    if (
      typeof plugin === 'string'
        ? plugin === '@nx/next/plugin'
        : plugin.plugin === '@nx/next/plugin'
    ) {
      return;
    }
  }

  nxJson.plugins.push({
    plugin: '@nx/next/plugin',
    options: {
      buildTargetName: 'build',
      devTargetName: 'dev',
      startTargetName: 'start',
    },
  });

  updateNxJson(tree, nxJson);
}
