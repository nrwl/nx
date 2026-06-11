import { NxReleaseConfiguration } from '../../config/nx-json';
import { PlanCheckOptions, PlanOptions } from './command-object';
export declare const releasePlanCheckCLIHandler: (args: PlanCheckOptions) => Promise<number>;
export declare function createAPI(overrideReleaseConfig: NxReleaseConfiguration): (args: PlanOptions) => Promise<number>;
