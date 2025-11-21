import { Tree, readNxJson } from '@nx/devkit';
import { hasGradlePlugin } from '../../utils/has-gradle-plugin';
import { addNxProjectGraphPlugin } from '../../generators/init/gradle-project-graph-plugin-utils';

/* Change the plugin version to 0.1.4
 */
export default async function update(tree: Tree) {
  const nxJson = readNxJson(tree);
  if (!nxJson) {
    return;
  }
  if (!hasGradlePlugin(tree)) {
    return;
  }
  await addNxProjectGraphPlugin(tree, '0.1.4');
}
