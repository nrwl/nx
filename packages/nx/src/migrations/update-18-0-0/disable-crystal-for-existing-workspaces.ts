import { readNxJson, updateNxJson } from '../../generators/utils/nx-json';
import { Tree } from '../../generators/tree';
import { formatChangedFiles } from '../../generators/internal-utils/format-changed-files';

export default async function migrate(tree: Tree) {
  const nxJson = readNxJson(tree);
  if (!nxJson) {
    throw new Error('Cannot find nx.json');
  }
  nxJson.useInferencePlugins = false;
  updateNxJson(tree, nxJson);

  await formatChangedFiles(tree);
}
