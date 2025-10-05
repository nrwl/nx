import { Tree } from '../../generators/tree';
import { formatChangedFilesWithPrettierIfAvailable } from '../../generators/internal-utils/format-changed-files-with-prettier-if-available';
import { readNxJson, updateNxJson } from '../../generators/utils/nx-json';
import { NxJsonConfiguration } from '../../config/nx-json';

function isCustomRunnerPath(modulePath: string) {
  return !['nx-cloud', '@nrwl/nx-cloud', 'nx/tasks-runners/default'].includes(
    modulePath
  );
}

export default async function update(tree: Tree) {
  const nxJson = readNxJson(tree) as NxJsonConfiguration;

  if (!nxJson?.tasksRunnerOptions) {
    return;
  }

  const nextSteps: string[] = [];

  for (const key in nxJson.tasksRunnerOptions) {
    const runner = nxJson.tasksRunnerOptions[key].runner;

    if (runner && isCustomRunnerPath(runner)) {
      let nextStepText =
        'Nx 21 removed support for custom task runners. For more information, please check: ';
      if (runner === '@nx-aws-cache/nx-aws-cache') {
        nextStepText +=
          'https://nx.dev/deprecated/custom-tasks-runner#migrating-from-nxawsplugin';
      } else {
        nextStepText += 'https://nx.dev/deprecated/custom-tasks-runner';
      }
      if (nextSteps.length === 0) {
        nextSteps.push(nextStepText);
      }
      delete nxJson.tasksRunnerOptions[key];
    }
  }
  if (Object.keys(nxJson.tasksRunnerOptions).length === 0) {
    delete nxJson.tasksRunnerOptions;
  }

  updateNxJson(tree, nxJson);

  await formatChangedFilesWithPrettierIfAvailable(tree);
  return nextSteps;
}
