import { Tree } from '../../generators/tree';
import {
  getProjects,
  updateProjectConfiguration,
} from '../../generators/utils/project-configuration';
import { formatChangedFilesWithPrettierIfAvailable } from '../../generators/internal-utils/format-changed-files-with-prettier-if-available';

export default async function (tree: Tree) {
  // This looks like it does nothing, but this will actually effectively migrate over all the configs that need to be moved over, but won't touch configs that don't need to be moved
  for (const [projName, projConfig] of getProjects(tree)) {
    updateProjectConfiguration(tree, projName, projConfig);
  }

  await formatChangedFilesWithPrettierIfAvailable(tree);
}
