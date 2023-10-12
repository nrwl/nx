import { updateJson } from '../../generators/utils/json';
import { Tree } from '../../generators/tree';
import { NxJsonConfiguration } from '../../config/nx-json';

export default async function migrate(tree: Tree) {
  if (!tree.exists('nx.json')) {
    return;
  }
  updateJson<NxJsonConfiguration>(tree, 'nx.json', (nxJson) => {
    // Already migrated
    if (!nxJson.tasksRunnerOptions?.default) {
      return nxJson;
    }

    const { runner, options } = nxJson.tasksRunnerOptions.default;

    // This property shouldn't ever be part of tasks runner options.
    if (options.useDaemonProcess !== undefined) {
      nxJson.useDaemonProcess = options.useDaemonProcess;
      delete options.useDaemonProcess;
    }

    // Remaining keys may be specific to a given runner, so leave them alone if there are multiple runners.
    if (Object.keys(nxJson.tasksRunnerOptions ?? {}).length > 1) {
      return nxJson;
    }

    // These options can only be moved for nx-cloud.
    if (runner === 'nx-cloud' || runner === '@nrwl/nx-cloud') {
      nxJson.nxCloudAccessToken = options.accessToken;
      delete options.accessToken;

      if (options.url) {
        nxJson.nxCloudUrl = options.url;
        delete options.url;
      }
      if (options.encryptionKey) {
        nxJson.nxCloudEncryptionKey = options.encryptionKey;
        delete options.encryptionKey;
      }
    }

    // These options should be safe to move for all tasks runners:
    if (options.parallel !== undefined) {
      nxJson.parallel = options.parallel;
      delete options.parallel;
    }
    if (options.cacheDirectory !== undefined) {
      nxJson.cacheDirectory = options.cacheDirectory;
      delete options.cacheDirectory;
    }
    if (Array.isArray(options.cacheableOperations)) {
      nxJson.targetDefaults ??= {};
      for (const target of options.cacheableOperations) {
        nxJson.targetDefaults[target] ??= {};
        nxJson.targetDefaults[target].cache ??= true;
      }
      delete options.cacheableOperations;
    }
    if (
      ['nx-cloud', '@nrwl/nx-cloud', 'nx/tasks-runners/default'].includes(
        runner
      )
    ) {
      delete nxJson.tasksRunnerOptions.default.runner;
      if (Object.values(options).length === 0) {
        delete nxJson.tasksRunnerOptions;
      }
    }
    return nxJson;
  });
}
