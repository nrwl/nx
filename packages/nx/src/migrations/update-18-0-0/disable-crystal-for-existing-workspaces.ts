import { readNxJson, updateNxJson } from '../../generators/utils/nx-json.js';
import { Tree } from '../../generators/tree.js';
import { formatChangedFilesWithPrettierIfAvailable } from '../../generators/internal-utils/format-changed-files-with-prettier-if-available.js';

export default async function migrate(tree: Tree) {
  const nxJson = readNxJson(tree);
  nxJson.useInferencePlugins = false;
  updateNxJson(tree, nxJson);

  await formatChangedFilesWithPrettierIfAvailable(tree);
}
