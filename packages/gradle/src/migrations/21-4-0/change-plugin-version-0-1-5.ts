import { Tree, readNxJson } from '@nx/devkit';
import { hasGradlePlugin } from '../../utils/has-gradle-plugin';
import { addNxProjectGraphPlugin } from '../../generators/init/gradle-project-graph-plugin-utils';
import { updateNxPluginVersionInCatalogs } from '../../utils/version-catalog-utils';

/* Change the plugin version to 0.1.5
 */
export default async function update(tree: Tree) {
  const nxJson = readNxJson(tree);
  if (!nxJson) {
    return;
  }
  if (!hasGradlePlugin(tree)) {
    return;
  }

  // Update version in version catalogs first
  console.log('Updating plugin version in version catalogs...');
  await updateNxPluginVersionInCatalogs(tree, '0.1.5');

  // Then update in build.gradle(.kts) files
  console.log('Updating plugin version in build.gradle(.kts) files...');
  await addNxProjectGraphPlugin(tree, '0.1.5');
}
