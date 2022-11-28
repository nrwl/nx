import { Tree } from '../../generators/tree';
import { readNxJson } from '../../generators/utils/project-configuration';
import { globForProjectFiles } from '../../config/workspaces';
import { dirname } from 'path';
import { readJson, writeJson } from '../../generators/utils/json';
import { formatChangedFilesWithPrettierIfAvailable } from '../../generators/internal-utils/format-changed-files-with-prettier-if-available';

export default async function (tree: Tree) {
  const nxConfig = readNxJson(tree);
  const projectFiles = globForProjectFiles(tree.root, nxConfig);
  const projectJsons = projectFiles.filter((f) => f.endsWith('project.json'));

  for (let f of projectJsons) {
    const projectJson = readJson(tree, f);
    if (!projectJson.name) {
      projectJson.name = toProjectName(dirname(f), nxConfig);
      writeJson(tree, f, projectJson);
    }
  }
  await formatChangedFilesWithPrettierIfAvailable(tree);
}

function toProjectName(directory: string, nxConfig: any): string {
  let { appsDir, libsDir } = nxConfig?.workspaceLayout || {};
  appsDir ??= 'apps';
  libsDir ??= 'libs';
  const parts = directory.split(/[\/\\]/g);
  if ([appsDir, libsDir].includes(parts[0])) {
    parts.splice(0, 1);
  }
  return parts.join('-').toLowerCase();
}
