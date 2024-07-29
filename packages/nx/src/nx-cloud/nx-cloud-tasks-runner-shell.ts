import { findAncestorNodeModules } from './resolution-helpers';
import {
  NxCloudClientUnavailableError,
  NxCloudEnterpriseOutdatedError,
  verifyOrUpdateNxCloudClient,
} from './update-manager';
import {
  defaultTasksRunner,
  DefaultTasksRunnerOptions,
} from '../tasks-runner/default-tasks-runner';
import { TasksRunner } from '../tasks-runner/tasks-runner';
import { output } from '../utils/output';
import { Task } from '../config/task-graph';

export interface CloudTaskRunnerOptions extends DefaultTasksRunnerOptions {
  accessToken?: string;
  canTrackAnalytics?: boolean;
  encryptionKey?: string;
  maskedProperties?: string[];
  showUsageWarnings?: boolean;
  customProxyConfigPath?: string;
  useLatestApi?: boolean;
  url?: string;
  useLightClient?: boolean;
  clientVersion?: string;
  nxCloudId?: string;
}

export const nxCloudTasksRunnerShell: TasksRunner<
  CloudTaskRunnerOptions
> = async (tasks: Task[], options: CloudTaskRunnerOptions, context) => {
  try {
    const { nxCloudClient, version } = await verifyOrUpdateNxCloudClient(
      options
    );

    options.clientVersion = version;

    const paths = findAncestorNodeModules(__dirname, []);
    nxCloudClient.configureLightClientRequire()(paths);

    return nxCloudClient.nxCloudTasksRunner(tasks, options, context);
  } catch (e: any) {
    const body =
      e instanceof NxCloudEnterpriseOutdatedError
        ? [
            'If you are an Nx Enterprise customer, please reach out to your assigned Developer Productivity Engineer.',
            'If you are NOT an Nx Enterprise customer but are seeing this message, please reach out to cloud-support@nrwl.io.',
          ]
        : e instanceof NxCloudClientUnavailableError
        ? [
            'You might be offline. Nx Cloud will be re-enabled when you are back online.',
          ]
        : [];

    if (e instanceof NxCloudEnterpriseOutdatedError) {
      output.warn({
        title: e.message,
        bodyLines: ['Nx Cloud will not used for this command.', ...body],
      });
    }
    const results = await defaultTasksRunner(tasks, options, context);
    output.warn({
      title: e.message,
      bodyLines: ['Nx Cloud was not used for this command.', ...body],
    });
    return results;
  }
};
