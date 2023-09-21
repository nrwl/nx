import { Tree } from '../../generators/tree';
import { updateJson } from '../../generators/utils/json';
import { formatChangedFilesWithPrettierIfAvailable } from '../../generators/internal-utils/format-changed-files-with-prettier-if-available';

export default async function removeProjectNameAndRootFormat(tree: Tree) {
  if (!tree.exists('nx.json')) {
    return;
  }

  updateJson(tree, 'nx.json', (nxJson) => {
    if (!nxJson.workspaceLayout) {
      return nxJson;
    }

    delete nxJson.workspaceLayout.projectNameAndRootFormat;

    if (Object.keys(nxJson.workspaceLayout).length === 0) {
      delete nxJson.workspaceLayout;
    }

    return nxJson;
  });

  await formatChangedFilesWithPrettierIfAvailable(tree);
}
