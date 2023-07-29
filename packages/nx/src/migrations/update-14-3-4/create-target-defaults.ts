import { TargetDependencyConfig } from '../../config/workspace-json-project-json';
import { NxJsonConfiguration } from '../../config/nx-json';
import { formatChangedFilesWithPrettierIfAvailable } from '../../generators/internal-utils/format-changed-files-with-prettier-if-available';
import { Tree } from '../../generators/tree';
import { readNxJson, updateNxJson } from '../../generators/utils/nx-json';

export default async function (tree: Tree) {
  // If the workspace doesn't have a nx.json, don't make any changes
  if (!tree.exists('nx.json')) {
    return;
  }

  const nxJson: NxJsonConfiguration & {
    targetDependencies?: Record<string, TargetDependencyConfig[]>;
  } = readNxJson(tree);

  if (nxJson.targetDependencies) {
    nxJson.targetDefaults = {};
    for (const targetName of Object.keys(nxJson.targetDependencies)) {
      const dependsOn = [];

      for (const c of nxJson.targetDependencies[targetName]) {
        if (typeof c === 'string') {
          dependsOn.push(c);
        } else if (c.projects === 'self') {
          dependsOn.push(c.target);
        } else {
          dependsOn.push(`^${c.target}`);
        }
      }

      nxJson.targetDefaults[targetName] = {
        dependsOn,
      };
    }
  }
  delete nxJson.targetDependencies;
  updateNxJson(tree, nxJson);

  await formatChangedFilesWithPrettierIfAvailable(tree);
}
