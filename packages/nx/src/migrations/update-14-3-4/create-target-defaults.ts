import { Tree } from '../../generators/tree';
import {
  readWorkspaceConfiguration,
  updateWorkspaceConfiguration,
} from '../../generators/utils/project-configuration';
import { formatChangedFilesWithPrettierIfAvailable } from '../../generators/internal-utils/format-changed-files-with-prettier-if-available';

export default async function (tree: Tree) {
  const workspaceConfiguration = readWorkspaceConfiguration(tree);

  if (workspaceConfiguration.targetDependencies) {
    workspaceConfiguration.targetDefaults = {};
    for (const targetName of Object.keys(
      workspaceConfiguration.targetDependencies
    )) {
      const dependsOn = [];

      for (const c of workspaceConfiguration.targetDependencies[targetName]) {
        if (typeof c === 'string') {
          dependsOn.push(c);
        } else if (c.projects === 'self') {
          dependsOn.push(c.target);
        } else {
          dependsOn.push(`^${c.target}`);
        }
      }

      workspaceConfiguration.targetDefaults[targetName] = {
        dependsOn,
      };
    }
  }
  delete workspaceConfiguration.targetDependencies;
  updateWorkspaceConfiguration(tree, workspaceConfiguration);

  await formatChangedFilesWithPrettierIfAvailable(tree);
}
