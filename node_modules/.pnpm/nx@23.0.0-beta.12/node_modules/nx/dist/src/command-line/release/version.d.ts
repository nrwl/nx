import { NxReleaseConfiguration } from '../../config/nx-json';
import { VersionOptions } from './command-object';
import { ReleaseGraph } from './utils/release-graph';
import { VersionData } from './utils/shared';
export interface NxReleaseVersionResult {
    /**
     * In one specific (and very common) case, an overall workspace version is relevant, for example when there is
     * only a single release group in which all projects have a fixed relationship to each other. In this case, the
     * overall workspace version is the same as the version of the release group (and every project within it). This
     * version could be a `string`, or it could be `null` if using conventional commits and no changes were detected.
     *
     * In all other cases (independent versioning, multiple release groups etc), the overall workspace version is
     * not applicable and will be `undefined` here. If a user attempts to use this value later when it is `undefined`
     * (for example in the changelog command), we will throw an appropriate error.
     */
    workspaceVersion: (string | null) | undefined;
    projectsVersionData: VersionData;
    /**
     * The release graph that was built or reused during this operation.
     * This can be passed to subsequent operations (changelog, publish) to avoid recomputing.
     */
    releaseGraph: ReleaseGraph;
}
export declare const releaseVersionCLIHandler: (args: VersionOptions) => Promise<number>;
export declare function createAPI(overrideReleaseConfig: NxReleaseConfiguration, ignoreNxJsonConfig: boolean): (args: VersionOptions) => Promise<NxReleaseVersionResult>;
