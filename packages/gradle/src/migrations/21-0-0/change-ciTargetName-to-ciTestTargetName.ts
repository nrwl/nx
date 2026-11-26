import { Tree, readNxJson, updateNxJson } from '@nx/devkit';
import { hasGradlePlugin } from '../../utils/has-gradle-plugin';

/* This function changes the @nx/gradle plugin option from ciTargetName to ciTestTargetName
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
  if (
    typeof gradlePlugin === 'object' &&
    gradlePlugin.plugin === '@nx/gradle'
  ) {
    const ciTargetName = (gradlePlugin.options as Record<string, string>)?.[
      'ciTargetName'
    ];
    if (ciTargetName) {
      delete (gradlePlugin.options as Record<string, string>)?.['ciTargetName'];
      (gradlePlugin.options as Record<string, string>)['ciTestTargetName'] =
        ciTargetName;
    }
  }
  updateNxJson(tree, nxJson);
}
