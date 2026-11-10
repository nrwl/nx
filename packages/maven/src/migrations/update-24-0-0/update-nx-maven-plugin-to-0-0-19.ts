import { Tree } from '@nx/devkit';
import { updateNxMavenPluginVersion } from '../../utils/pom-xml-updater';

const nxMavenPluginVersion = '0.0.19';

export default async function update(tree: Tree) {
  updateNxMavenPluginVersion(tree, nxMavenPluginVersion);
}
