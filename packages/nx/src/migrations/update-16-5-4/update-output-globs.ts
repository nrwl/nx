import { Tree } from '../../generators/tree';
import {
  getProjects,
  updateProjectConfiguration,
} from '../../generators/utils/project-configuration';
import { formatChangedFilesWithPrettierIfAvailable } from '../../generators/internal-utils/format-changed-files-with-prettier-if-available';

export default async function updateOutputsGlobs(tree: Tree) {
  for (const [projectName, projectConfiguration] of getProjects(
    tree
  ).entries()) {
    for (const [targetName, targetConfiguration] of Object.entries(
      projectConfiguration.targets
    )) {
      if (!Array.isArray(targetConfiguration.outputs)) {
        continue;
      }

      let outputs = [];
      for (const output of targetConfiguration.outputs ?? []) {
        // replace {projectRoot}/folder/*.(js|map|ts) to {projectRoot}/folder/*.{js,map,ts}
        const regex = /\(([^)]+)\)/g;
        const newOutput = output.replace(regex, (match, group1) => {
          let replacements = group1.split('|').join(',');
          return `{${replacements}}`;
        });

        outputs.push(newOutput);
      }

      targetConfiguration.outputs = outputs;
    }
    updateProjectConfiguration(tree, projectName, projectConfiguration);
  }
  await formatChangedFilesWithPrettierIfAvailable(tree);
}
