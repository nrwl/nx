import { CloudTaskRunnerOptions } from '../core/models/cloud-task-runner-options';
import { debugLog } from './debug-logger';
import { findAncestorNodeModules } from './resolution-helpers';
import { verifyOrUpdateCloudBundle } from './update-manager';

export const nxCloudTasksRunnerShell: any = async (
  tasks: any[],
  options: CloudTaskRunnerOptions,
  context: any = {}
) => {
  debugLog('Using light client');
  const cloudBundleInstall = await verifyOrUpdateCloudBundle(options);

  if (cloudBundleInstall === null) {
    // Disable cloud entirely if unable to download light client
    if (context.nxArgs) {
      context.nxArgs.cloud = false;
    } else {
      context.nxArgs = { cloud: false };
    }

    throw new Error('TODO implement this');
    // return nxCloudTasksRunner(tasks, options, context);
  }

  debugLog('Using bundle path: ', cloudBundleInstall);

  options.clientVersion = cloudBundleInstall.version;

  const lightClient = require(cloudBundleInstall.fullPath);

  const paths = findAncestorNodeModules(__dirname, []);
  lightClient.configureLightClientRequire()(paths);

  if (!lightClient.commands) {
    throw new Error('Update Enterprise');
  }

  return lightClient.nxCloudTasksRunner(tasks, options, context);
};
