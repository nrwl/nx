import { Tree } from '../../generators/tree';
import { readNxJson } from '../../generators/utils/nx-json';
import {
  getGlobPatternsFromPluginsAsync,
  globForProjectFiles,
} from '../../config/workspaces';
import { dirname } from 'path';
import { readJson, writeJson } from '../../generators/utils/json';
import { formatChangedFilesWithPrettierIfAvailable } from '../../generators/internal-utils/format-changed-files-with-prettier-if-available';
import { getNxRequirePaths } from '../../utils/installation-directory';

export default async function (tree: Tree) {
  const nxJson = readNxJson(tree);
  const projectFiles = globForProjectFiles(
    tree.root,
    await getGlobPatternsFromPluginsAsync(
      nxJson,
      getNxRequirePaths(tree.root),
      tree.root
    ),
    nxJson
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
