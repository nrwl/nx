import { Tree } from '@nx/devkit';
import { updateNxMavenPluginVersion } from '../../utils/pom-xml-updater';

const nxMavenPluginVersion = '0.0.18';

export default async function update(tree: Tree) {
  updateNxMavenPluginVersion(tree, nxMavenPluginVersion);
}
