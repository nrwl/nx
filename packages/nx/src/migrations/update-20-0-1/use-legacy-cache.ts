import { Tree } from '../../generators/tree';
import { formatChangedFiles } from '../../generators/internal-utils/format-changed-files';
import { readNxJson, updateNxJson } from '../../generators/utils/nx-json';
import { NxJsonConfiguration } from '../../config/nx-json';

export default async function update(tree: Tree) {
  const nxJson = readNxJson(tree) as NxJsonConfiguration;

  if (!nxJson) {
    return;
  }

  // If workspaces  had `enableDbCache` we can just delete the property as the db cache is enabled by default in nx v20
  if ((nxJson as any).enableDbCache) {
    delete (nxJson as any).enableDbCache;
  } else {
    (
      nxJson as NxJsonConfiguration & { useLegacyCache: boolean }
    ).useLegacyCache = true;
  }

  updateNxJson(tree, nxJson);

  await formatChangedFiles(tree);
}
