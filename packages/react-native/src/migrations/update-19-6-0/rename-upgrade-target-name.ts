import { formatFiles, readNxJson, Tree, updateNxJson } from '@nx/devkit';

/**
 * There was a typo in @nx/react-native/plugin, where "upgradeTargetName" was "upgradeTargetname"
 */
export default async function update(tree: Tree) {
  const nxJson = readNxJson(tree);
  if (!nxJson.plugins) return;
  let updated = false;
  for (const plugin of nxJson.plugins) {
    if (typeof plugin === 'string') continue;
    if (plugin.plugin !== '@nx/react-native/plugin') continue;
    if (plugin.options['upgradeTargetname']) {
      plugin.options['upgradeTargetName'] = plugin.options['upgradeTargetname'];
      delete plugin.options['upgradeTargetname'];
      updated = true;
    }
  }
  if (updated) updateNxJson(tree, nxJson);
  await formatFiles(tree);
}
