import { NxReleaseConfiguration } from '../../config/nx-json';
import { ReleaseOptions, VersionOptions } from './command-object';
import { NxReleaseVersionResult } from './version';
export declare const releaseCLIHandler: (args: VersionOptions) => Promise<number>;
export declare function createAPI(overrideReleaseConfig: NxReleaseConfiguration, ignoreNxJsonConfig: boolean): (args: ReleaseOptions) => Promise<NxReleaseVersionResult>;
