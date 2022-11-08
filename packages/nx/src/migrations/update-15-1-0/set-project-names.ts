import { Tree } from '../../generators/tree';
import {
  getProjects,
  readNxJson,
  updateProjectConfiguration,
} from '../../generators/utils/project-configuration';
import { formatChangedFilesWithPrettierIfAvailable } from '../../generators/internal-utils/format-changed-files-with-prettier-if-available';
import { join } from 'path';

export default async function (tree: Tree) {
  // This looks like it does nothing, but this will actually effectively migrate over all the configs that need to be moved over, but won't touch configs that don't need to be moved
  for (const [projName, projConfig] of getProjects(tree)) {
    if (tree.exists(join(projConfig.root, 'project.json'))) {
      if (!projConfig.name) {
        projConfig.name = toProjectName(projConfig.root, readNxJson(tree));
      }
      updateProjectConfiguration(tree, projName, projConfig);
    }
  }

  await formatChangedFilesWithPrettierIfAvailable(tree);
}

function toProjectName(directory: string, nxJson: any): string {
  let { appsDir, libsDir } = nxJson?.workspaceLayout || {};
  appsDir ??= 'apps';
  libsDir ??= 'libs';
  const parts = directory.split(/[\/\\]/g);
  if ([appsDir, libsDir].includes(parts[0])) {
    parts.splice(0, 1);
  }
  return parts.join('-').toLowerCase();
}
