import { Tree } from '../../generators/tree';
import { formatChangedFilesWithPrettierIfAvailable } from '../../generators/internal-utils/format-changed-files-with-prettier-if-available';
import {
  getProjects,
  readWorkspaceConfiguration,
  updateProjectConfiguration,
  updateWorkspaceConfiguration,
} from '../../generators/utils/project-configuration';
import { joinPathFragments } from '../../utils/path';
import { join, relative } from 'path';
import {
  transformLegacyOutputs,
  validateOutputs,
} from 'nx/src/tasks-runner/utils';
import { updateJson } from '../../generators/utils/json';
import { PackageJson } from '../../utils/package-json';

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
    if (tree.exists(join(project.root, 'project.json'))) {
      updateProjectConfiguration(tree, projectName, project);
    } else if (tree.exists(join(project.root, 'package.json'))) {
      updateJson<PackageJson>(
        tree,
        join(project.root, 'package.json'),
        (json) => {
          json.nx ??= {};
          json.nx.targets ??= project.targets;

          return json;
        }
      );
    }
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
