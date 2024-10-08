/* eslint-disable @typescript-eslint/no-unused-vars */
import { Tree } from '../../generators/tree';
import { formatChangedFilesWithPrettierIfAvailable } from '../../generators/internal-utils/format-changed-files-with-prettier-if-available';
import { readNxJson, updateNxJson } from '../../generators/utils/nx-json';
import { NxJsonConfiguration } from '../../config/nx-json';

export default async function update(tree: Tree) {
  const nxJson = readNxJson(tree) as NxJsonConfiguration;

  if (
    nxJson?.tasksRunnerOptions?.['default']?.options?.useDaemonProcess !==
    undefined
  ) {
    nxJson.useDaemonProcess =
      nxJson.tasksRunnerOptions['default'].options.useDaemonProcess;

    delete nxJson.tasksRunnerOptions['default'].options.useDaemonProcess;

    if (
      Object.keys(nxJson.tasksRunnerOptions['default'].options).length === 0
    ) {
      delete nxJson.tasksRunnerOptions['default'].options;
    }

    if (Object.keys(nxJson.tasksRunnerOptions['default']).length === 0) {
      delete nxJson.tasksRunnerOptions['default'];
    }

    if (Object.keys(nxJson.tasksRunnerOptions).length === 0) {
      delete nxJson.tasksRunnerOptions;
    }

    updateNxJson(tree, nxJson);
  }

  await formatChangedFilesWithPrettierIfAvailable(tree);
}
