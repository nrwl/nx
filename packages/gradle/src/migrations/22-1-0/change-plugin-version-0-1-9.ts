import { Tree, readNxJson } from '@nx/devkit';
import { hasGradlePlugin } from '../../utils/has-gradle-plugin.js';
import { addNxProjectGraphPlugin } from '../../generators/init/gradle-project-graph-plugin-utils.js';
import { updateNxPluginVersionInCatalogsAst } from '../../utils/version-catalog-ast-utils.js';

/* Change the plugin version to 0.1.9
 */
export default async function update(tree: Tree) {
  const nxJson = readNxJson(tree);
  if (!nxJson) {
    return;
  }
  if (!hasGradlePlugin(tree)) {
    return;
  }

  const gradlePluginVersionToUpdate = '0.1.9';

  // Update version in version catalogs using AST-based approach to preserve formatting
  await updateNxPluginVersionInCatalogsAst(tree, gradlePluginVersionToUpdate);

  // Then update in build.gradle(.kts) files
  await addNxProjectGraphPlugin(tree, gradlePluginVersionToUpdate);
}
