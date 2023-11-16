import { Tree } from '../../generators/tree';
import { readNxJson } from '../../generators/utils/nx-json';
import { dirname } from 'path';
import { readJson, writeJson } from '../../generators/utils/json';
import { formatChangedFilesWithPrettierIfAvailable } from '../../generators/internal-utils/format-changed-files-with-prettier-if-available';
import { retrieveProjectConfigurationPaths } from '../../project-graph/utils/retrieve-workspace-files';
import { loadNxPlugins } from '../../utils/nx-plugin';

export default async function (tree: Tree) {
  const nxJson = readNxJson(tree);
  const projectFiles = await retrieveProjectConfigurationPaths(
    tree.root,
    await loadNxPlugins(nxJson?.plugins)
  );
  const projectJsons = projectFiles.filter((f) => f.endsWith('project.json'));

  for (let f of projectJsons) {
    const projectJson = readJson(tree, f);
    if (!projectJson.name) {
      projectJson.name = toProjectName(dirname(f), nxJson);
      writeJson(tree, f, projectJson);
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
