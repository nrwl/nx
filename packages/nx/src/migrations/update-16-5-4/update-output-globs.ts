import { Tree } from '../../generators/tree';
import {
  getProjects,
  updateProjectConfiguration,
} from '../../generators/utils/project-configuration';
import { formatChangedFilesWithPrettierIfAvailable } from '../../generators/internal-utils/format-changed-files-with-prettier-if-available';
import { TargetConfiguration } from '../../config/workspace-json-project-json';
import { updateJson } from '../../generators/utils/json';
import { NxJsonConfiguration } from '../../config/nx-json';

function replaceOutput(output: string) {
  // replace {projectRoot}/folder/*.(js|map|ts) to {projectRoot}/folder/*.{js,map,ts}
  const regex = /\(([^)]+)\)/g;
  return output.replace(regex, (match, group1) => {
    let replacements = group1.split('|').join(',');
    return `{${replacements}}`;
  });
}

export default async function updateOutputsGlobs(tree: Tree) {
  for (const [projectName, projectConfiguration] of getProjects(
    tree
  ).entries()) {
    for (const [targetName, targetConfiguration] of Object.entries(
      projectConfiguration.targets ?? {}
    )) {
      if (!Array.isArray(targetConfiguration.outputs)) {
        continue;
      }

      targetConfiguration.outputs =
        targetConfiguration.outputs.map(replaceOutput);
    }
    updateProjectConfiguration(tree, projectName, projectConfiguration);
  }

  if (tree.exists('nx.json')) {
    updateJson<NxJsonConfiguration>(tree, 'nx.json', (json) => {
      for (const [, targetConfiguration] of Object.entries(
        json.targetDefaults ?? {}
      )) {
        if (!Array.isArray(targetConfiguration.outputs)) {
          continue;
        }

        targetConfiguration.outputs =
          targetConfiguration.outputs.map(replaceOutput);
      }
      return json;
    });
  }

  await formatChangedFilesWithPrettierIfAvailable(tree);
}
