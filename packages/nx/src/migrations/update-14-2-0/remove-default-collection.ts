import { Tree } from '../../generators/tree';
import {
  readNxJson,
  updateNxJson,
} from '../../generators/utils/project-configuration';
import { formatChangedFilesWithPrettierIfAvailable } from '../../generators/internal-utils/format-changed-files-with-prettier-if-available';

export default async function (tree: Tree) {
  const nxJson = readNxJson(tree);

  delete nxJson.cli?.defaultCollection;
  if (nxJson.cli && Object.keys(nxJson.cli).length === 0) {
    delete nxJson.cli;
  }

  updateNxJson(tree, nxJson);

  await formatChangedFilesWithPrettierIfAvailable(tree);
}
