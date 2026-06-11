import { NxReleaseConfiguration } from '../../config/nx-json';
import { ChangelogOptions } from './command-object';
import { ReleaseVersion } from './utils/shared';
export interface NxReleaseChangelogResult {
    workspaceChangelog?: {
        releaseVersion: ReleaseVersion;
        contents: string;
        postGitTask: PostGitTask | null;
    };
    projectChangelogs?: {
        [projectName: string]: {
            releaseVersion: ReleaseVersion;
            contents: string;
            postGitTask: PostGitTask | null;
        };
    };
}
export type { ChangelogChange } from './changelog/version-plan-utils';
export type PostGitTask = (latestCommit: string) => Promise<void>;
export declare const releaseChangelogCLIHandler: (args: ChangelogOptions) => Promise<number>;
export declare function createAPI(overrideReleaseConfig: NxReleaseConfiguration, ignoreNxJsonConfig: boolean): (args: ChangelogOptions) => Promise<NxReleaseChangelogResult>;
