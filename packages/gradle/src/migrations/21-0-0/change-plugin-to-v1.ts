import { Tree, readNxJson, updateNxJson } from '@nx/devkit';
import { hasGradlePlugin } from '../../utils/has-gradle-plugin';

/* This function changes the plugin to v1
 * Replace @nx/gradle with @nx/gradle/plugin-v1
 */
export default function update(tree: Tree) {
  const nxJson = readNxJson(tree);
  if (!nxJson) {
    return;
  }
  if (!hasGradlePlugin(tree)) {
    return;
  }
  let gradlePluginIndex = nxJson.plugins.findIndex((p) =>
    typeof p === 'string' ? p === '@nx/gradle' : p.plugin === '@nx/gradle'
  );
  let gradlePlugin = nxJson.plugins[gradlePluginIndex];
  if (typeof gradlePlugin === 'string') {
    nxJson.plugins[gradlePluginIndex] = '@nx/gradle/plugin-v1';
  } else {
    gradlePlugin.plugin = '@nx/gradle/plugin-v1';
  }
  updateNxJson(tree, nxJson);
}
