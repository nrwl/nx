import { Tree } from '../../generators/tree';
import { formatChangedFilesWithPrettierIfAvailable } from '../../generators/internal-utils/format-changed-files-with-prettier-if-available';
import {
  getProjects,
  updateProjectConfiguration,
} from '../../generators/utils/project-configuration';
import { readNxJson, updateNxJson } from '../../generators/utils/nx-json';
import { joinPathFragments } from '../../utils/path';
import { join } from 'path';
import {
  transformLegacyOutputs,
  validateOutputs,
} from '../../tasks-runner/utils';
import { updateJson } from '../../generators/utils/json';
import { PackageJson } from '../../utils/package-json';

export default async function (tree: Tree) {
  // If the workspace doesn't have a nx.json, don't make any changes
  if (!tree.exists('nx.json')) {
    return;
  }

  const nxJson = readNxJson(tree);

  for (const [projectName, project] of getProjects(tree)) {
    for (const [_, target] of Object.entries(project.targets ?? {})) {
      if (!target.outputs) {
        continue;
      }

      target.outputs = transformLegacyOutputs(project.root, target.outputs);
    }
    try {
      updateProjectConfiguration(tree, projectName, project);
    } catch {
      if (tree.exists(join(project.root, 'package.json'))) {
        updateJson<PackageJson>(
          tree,
          join(project.root, 'package.json'),
          (json) => {
            for (const target of Object.values(json.nx?.targets ?? {})) {
              if (target.outputs) {
                target.outputs = transformLegacyOutputs(
                  project.root,
                  target.outputs
                );
              }
            }

            return json;
          }
        );
      }
    }
  }

  if (nxJson.targetDefaults) {
    for (const [_, target] of Object.entries(nxJson.targetDefaults)) {
      if (!target.outputs) {
        continue;
      }
      target.outputs = transformLegacyOutputs('{projectRoot}', target.outputs);
    }

    updateNxJson(tree, nxJson);
  }

  await formatChangedFilesWithPrettierIfAvailable(tree);
}
