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
  const plugins = nxJson.plugins;
  if (!plugins || !hasGradlePlugin(tree)) {
    return;
  }
  let gradlePluginIndex = plugins.findIndex((p) =>
    typeof p === 'string' ? p === '@nx/gradle' : p.plugin === '@nx/gradle'
  );
  let gradlePlugin = plugins[gradlePluginIndex];
  if (typeof gradlePlugin === 'string') {
    plugins[gradlePluginIndex] = '@nx/gradle/plugin-v1';
  } else {
    gradlePlugin.plugin = '@nx/gradle/plugin-v1';
  }
  updateNxJson(tree, nxJson);
}
