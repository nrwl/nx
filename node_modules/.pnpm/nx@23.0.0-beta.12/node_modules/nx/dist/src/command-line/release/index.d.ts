import type { NxReleaseConfiguration } from '../../config/nx-json';
/**
 * @public
 */
export declare class ReleaseClient {
    /**
     * Nx release configuration to use for the current release client. By default, it will be combined with any
     * configuration in nx.json, but you can choose to use it as the sole source of truth by setting ignoreNxJsonConfig
     * to true.
     */
    private nxReleaseConfig;
    private ignoreNxJsonConfig;
    releaseChangelog: (args: import("./command-object").ChangelogOptions) => Promise<import("./changelog").NxReleaseChangelogResult>;
    releasePublish: (args: import("./command-object").PublishOptions) => Promise<import("./publish").PublishProjectsResult>;
    releaseVersion: (args: import("./command-object").VersionOptions) => Promise<import("./version").NxReleaseVersionResult>;
    release: (args: import("./command-object").ReleaseOptions) => Promise<import("./version").NxReleaseVersionResult>;
    constructor(
    /**
     * Nx release configuration to use for the current release client. By default, it will be combined with any
     * configuration in nx.json, but you can choose to use it as the sole source of truth by setting ignoreNxJsonConfig
     * to true.
     */
    nxReleaseConfig: NxReleaseConfiguration, ignoreNxJsonConfig?: boolean);
}
declare const defaultClient: ReleaseClient;
/**
 * @public
 */
export declare const releaseChangelog: typeof defaultClient.releaseChangelog;
/**
 * @public
 */
export { PublishProjectsResult } from './publish';
/**
 * @public
 */
export declare const releasePublish: typeof defaultClient.releasePublish;
/**
 * @public
 */
export declare const releaseVersion: typeof defaultClient.releaseVersion;
/**
 * @public
 */
export declare const release: typeof defaultClient.release;
/**
 * @public
 */
export { AfterAllProjectsVersioned, VersionActions, } from './version/version-actions';
