import { joinPathFragments, Tree, updateNxJson } from '@nx/devkit';
import { readNxJson } from '@nx/devkit';

export function addProjectRootToRspackPluginExcludesIfExists(
  tree: Tree,
  projectRoot: string
) {
  const excludeProjectGlob = joinPathFragments(projectRoot, '/**');
  const nxJson = readNxJson(tree);
  if (!nxJson.plugins?.length) {
    return;
  }
  for (let i = 0; i < nxJson.plugins.length; i++) {
    let plugin = nxJson.plugins[i];
    const isRspackPlugin =
      typeof plugin === 'string'
        ? plugin === '@nx/rspack/plugin'
        : plugin.plugin === '@nx/rspack/plugin';
    if (isRspackPlugin) {
      if (typeof plugin === 'string') {
        plugin = {
          plugin: plugin,
          exclude: [excludeProjectGlob],
        };
      } else {
        plugin.exclude = [...(plugin.exclude ?? []), excludeProjectGlob];
      }
      nxJson.plugins[i] = plugin;
    }
  }
  updateNxJson(tree, nxJson);
}
