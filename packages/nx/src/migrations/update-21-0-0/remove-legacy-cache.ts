import { Tree } from '../../generators/tree.js';
import { formatChangedFilesWithPrettierIfAvailable } from '../../generators/internal-utils/format-changed-files-with-prettier-if-available.js';
import { readNxJson, updateNxJson } from '../../generators/utils/nx-json.js';
import { NxJsonConfiguration } from '../../config/nx-json.js';

export default async function update(tree: Tree) {
  const nxJson = readNxJson(tree) as NxJsonConfiguration;

  if (!nxJson) {
    return;
  }

  // If workspaces  had `useLegacyCache` we can just delete the property as the property is not functional in nx v21
  if ((nxJson as any).useLegacyCache) {
    delete (nxJson as any).useLegacyCache;
  }

  updateNxJson(tree, nxJson);

  await formatChangedFilesWithPrettierIfAvailable(tree);
}
