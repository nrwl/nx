import { DefaultTasksRunnerOptions } from '../tasks-runner/default-tasks-runner';
import { TasksRunner } from '../tasks-runner/tasks-runner';
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
export declare const nxCloudTasksRunnerShell: TasksRunner<CloudTaskRunnerOptions>;
