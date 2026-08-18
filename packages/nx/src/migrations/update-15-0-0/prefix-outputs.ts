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
import { targetDefaultConfigs } from '../utils/target-defaults';

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
    // `targetDefaultConfigs` yields the live config block(s) of both value
    // forms (plain object and filtered array), so legacy outputs get prefixed
    // regardless of shape; any `filter` on an array entry is left untouched.
    for (const value of Object.values(nxJson.targetDefaults)) {
      for (const config of targetDefaultConfigs(value)) {
        if (config.outputs) {
          config.outputs = transformLegacyOutputs(
            '{projectRoot}',
            config.outputs
          );
        }
      }
    }

    updateNxJson(tree, nxJson);
  }

  await formatChangedFilesWithPrettierIfAvailable(tree);
}
