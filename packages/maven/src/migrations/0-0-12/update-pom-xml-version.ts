import { Tree } from '@nx/devkit';
import { updateNxMavenPluginVersion } from '../../utils/pom-xml-updater';

/**
 * Migration for @nx/maven v0.0.12
 * Updates the Maven plugin version to 0.0.12 in pom.xml files
 */
export default async function update(tree: Tree) {
  // Update user pom.xml files
  updateNxMavenPluginVersion(tree, '0.0.12');
}
