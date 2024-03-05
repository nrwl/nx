import { readNxJson, updateNxJson } from '../../generators/utils/nx-json';
import { Tree } from '../../generators/tree';

export default function migrate(tree: Tree) {
  const nxJson = readNxJson(tree);
  nxJson.useInferencePlugins = false;
  updateNxJson(tree, nxJson);
}
