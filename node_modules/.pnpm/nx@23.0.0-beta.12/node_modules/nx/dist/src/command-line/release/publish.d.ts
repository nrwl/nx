import { NxReleaseConfiguration } from '../../config/nx-json';
import { PublishOptions } from './command-object';
export interface PublishProjectsResult {
    [projectName: string]: {
        code: number;
    };
}
export declare const releasePublishCLIHandler: (args: PublishOptions) => Promise<number>;
export declare function createAPI(overrideReleaseConfig: NxReleaseConfiguration, ignoreNxJsonConfig: boolean): (args: PublishOptions) => Promise<PublishProjectsResult>;
