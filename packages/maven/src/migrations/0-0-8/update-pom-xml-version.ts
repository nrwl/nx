import { Tree } from '@nx/devkit';
import { updateNxMavenPluginVersion } from '../../utils/pom-xml-updater';

/**
 * Migration for @nx/maven v0.0.8
 * Updates the Maven plugin version from 0.0.7 to 0.0.8 in user pom.xml files
 */
export default async function update(tree: Tree) {
  updateNxMavenPluginVersion(tree, '0.0.8');
}
