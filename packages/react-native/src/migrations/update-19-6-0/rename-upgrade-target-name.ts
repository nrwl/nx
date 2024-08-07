import {
  Tree,
  formatFiles,
  getProjects,
  readNxJson,
  updateNxJson,
  updateProjectConfiguration,
  workspaceRoot,
} from '@nx/devkit';

import { runCliUpgrade } from '../../executors/upgrade/upgrade.impl';

/**
 * There was a typo in @nx/react-native/plugin, where "upgradeTargetName" was "upgradeTargetname"
 * Remove pod-install from dependsOn for all targets, it does pod-install when creating the app
 */
export default async function update(tree: Tree) {
  const nxJson = readNxJson(tree);
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
