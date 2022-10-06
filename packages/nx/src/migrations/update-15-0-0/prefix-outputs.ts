import { Tree } from '../../generators/tree';
import { formatChangedFilesWithPrettierIfAvailable } from '../../generators/internal-utils/format-changed-files-with-prettier-if-available';
import {
  getProjects,
  readWorkspaceConfiguration,
  updateProjectConfiguration,
  updateWorkspaceConfiguration,
} from '../../generators/utils/project-configuration';
import { joinPathFragments } from '../../utils/path';
import { relative } from 'path';
import {
  transformLegacyOutputs,
  validateOutputs,
} from 'nx/src/tasks-runner/utils';

export default async function (tree: Tree) {
  // If the workspace doesn't have a nx.json, don't make any changes
  if (!tree.exists('nx.json')) {
    return;
  }

  const workspaceConfiguration = readWorkspaceConfiguration(tree);

  for (const [projectName, project] of getProjects(tree)) {
    if (!project.targets) {
      continue;
    }

    for (const [_, target] of Object.entries(project.targets)) {
      if (!target.outputs) {
        continue;
      }

      try {
        validateOutputs(target.outputs);
      } catch (e) {
        target.outputs = transformLegacyOutputs(project.root, e);
      }
    }
    updateProjectConfiguration(tree, projectName, project);
  }

  if (workspaceConfiguration.targetDefaults) {
    for (const [_, target] of Object.entries(
      workspaceConfiguration.targetDefaults
    )) {
      if (!target.outputs) {
        continue;
      }

      target.outputs = target.outputs.map((output) => {
        return /^{[\s\S]+}/.test(output)
          ? output
          : joinPathFragments('{workspaceRoot}', output);
      });
    }

    updateWorkspaceConfiguration(tree, workspaceConfiguration);
  }

  await formatChangedFilesWithPrettierIfAvailable(tree);
}
