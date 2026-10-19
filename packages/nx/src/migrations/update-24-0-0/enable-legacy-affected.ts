import { formatChangedFiles } from '../../generators/internal-utils/format-changed-files';
import type { Tree } from '../../generators/tree';
import { readNxJson, updateNxJson } from '../../generators/utils/nx-json';

export default async function enableLegacyAffected(tree: Tree) {
  const nxJson = readNxJson(tree);
  if (!nxJson || nxJson.affected?.legacy !== undefined) {
    return { skipAgentic: true };
  }

  nxJson.affected = { ...nxJson.affected, legacy: true };
  updateNxJson(tree, nxJson);

  await formatChangedFiles(tree);
  return { skipAgentic: true };
}
