import { Tree } from '../../generators/tree';
import { formatChangedFilesWithPrettierIfAvailable } from '../../generators/internal-utils/format-changed-files-with-prettier-if-available';
import { readNxJson, updateNxJson } from '../../generators/utils/nx-json';
import { NxJsonConfiguration } from '../../config/nx-json';

export default async function update(tree: Tree) {
  const nxJson = readNxJson(tree) as NxJsonConfiguration;
  if (!nxJson) return;
  if ('useLegacyCache' in nxJson) {
    delete nxJson['useLegacyCache'];
    updateNxJson(tree, nxJson);
    await formatChangedFilesWithPrettierIfAvailable(tree);
  }
}
