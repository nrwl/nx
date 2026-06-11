import type { NxReleaseConfiguration } from '../../../config/nx-json';
import type { NxReleaseConfig } from '../config/config';
export declare function printConfigAndExit({ userProvidedReleaseConfig, nxReleaseConfig, isDebug, }: {
    userProvidedReleaseConfig: NxReleaseConfiguration;
    nxReleaseConfig: NxReleaseConfig;
    isDebug: boolean;
}): any;
