import { Tree } from '../../generators/tree';
import {
  readWorkspaceConfiguration,
  updateWorkspaceConfiguration,
} from '../../generators/utils/project-configuration';
import { formatChangedFilesWithPrettierIfAvailable } from '../../generators/internal-utils/format-changed-files-with-prettier-if-available';

export default async function (tree: Tree) {
  const workspaceConfiguration = readWorkspaceConfiguration(tree);

  delete workspaceConfiguration.cli?.defaultCollection;
  if (
    workspaceConfiguration.cli &&
    Object.keys(workspaceConfiguration.cli).length === 0
  ) {
    delete workspaceConfiguration.cli;
  }

  updateWorkspaceConfiguration(tree, workspaceConfiguration);

  await formatChangedFilesWithPrettierIfAvailable(tree);
}
