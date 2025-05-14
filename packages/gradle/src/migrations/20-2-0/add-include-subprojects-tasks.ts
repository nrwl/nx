import { Tree, readNxJson, updateNxJson } from '@nx/devkit';
import { hasGradlePlugin } from '../../utils/has-gradle-plugin';
import { GradlePluginOptions } from '../../plugin-v1/nodes';

// This function add options includeSubprojectsTasks as true in nx.json for gradle plugin
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
    gradlePlugin = {
      plugin: '@nx/gradle',
      options: {
        includeSubprojectsTasks: true,
      },
    };
    nxJson.plugins[gradlePluginIndex] = gradlePlugin;
  } else {
    gradlePlugin.options ??= {};
    (gradlePlugin.options as GradlePluginOptions).includeSubprojectsTasks =
      true;
  }
  updateNxJson(tree, nxJson);
}
