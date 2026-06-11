import { CloudTaskRunnerOptions } from '../nx-cloud-tasks-runner-shell';
export declare function getCloudOptions(directory?: string): CloudTaskRunnerOptions;
export declare function getCloudUrl(): string;
export declare function removeTrailingSlash(apiUrl: string): string;
export declare function isNxCloudId(token: string): boolean;
