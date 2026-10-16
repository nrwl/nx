import { formatChangedFiles } from '../../generators/internal-utils/format-changed-files';
import type { Tree } from '../../generators/tree';
import { readNxJson, updateNxJson } from '../../generators/utils/nx-json';

export default async function setAffectedGranularityToProject(tree: Tree) {
  const nxJson = readNxJson(tree);
  if (!nxJson || nxJson.affected?.granularity) {
    return { skipAgentic: true };
  }

  nxJson.affected = { ...nxJson.affected, granularity: 'project' };
  updateNxJson(tree, nxJson);

  await formatChangedFiles(tree);
  return { skipAgentic: true };
}
