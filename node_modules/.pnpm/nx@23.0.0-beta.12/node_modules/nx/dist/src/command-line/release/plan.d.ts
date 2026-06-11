import { NxReleaseConfiguration } from '../../config/nx-json';
import { PlanOptions } from './command-object';
export declare const releasePlanCLIHandler: (args: PlanOptions) => Promise<number>;
export declare function createAPI(overrideReleaseConfig: NxReleaseConfiguration): (args: PlanOptions) => Promise<string | number>;
