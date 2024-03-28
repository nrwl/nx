import { Tree } from '../../generators/tree';
import { readNxJson } from '../../generators/utils/nx-json';
import { dirname } from 'path';
import { readJson, writeJson } from '../../generators/utils/json';
import { formatChangedFilesWithPrettierIfAvailable } from '../../generators/internal-utils/format-changed-files-with-prettier-if-available';
import { retrieveProjectConfigurationPaths } from '../../project-graph/utils/retrieve-workspace-files';
import { loadNxPlugins } from '../../project-graph/plugins/internal-api';

export default async function (tree: Tree) {
  const nxJson = readNxJson(tree);
  const [plugins, cleanup] = await loadNxPlugins(
    nxJson?.plugins ?? [],
    tree.root
  );
  const projectFiles = retrieveProjectConfigurationPaths(tree.root, plugins);
  const projectJsons = projectFiles.filter((f) => f.endsWith('project.json'));

  for (let f of projectJsons) {
    const projectJson = readJson(tree, f);
    if (!projectJson.name) {
      projectJson.name = toProjectName(dirname(f), nxJson);
      writeJson(tree, f, projectJson);
    }
  }
  await formatChangedFilesWithPrettierIfAvailable(tree);
  cleanup();
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
