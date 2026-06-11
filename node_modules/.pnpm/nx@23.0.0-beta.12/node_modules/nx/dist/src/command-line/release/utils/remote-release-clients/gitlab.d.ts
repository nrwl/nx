import type { PostGitTask } from '../../changelog';
import type { ResolvedCreateRemoteReleaseProvider } from '../../config/config';
import type { Reference } from '../git';
import { ReleaseVersion } from '../shared';
import { RemoteReleaseClient, RemoteReleaseOptions, RemoteReleaseResult, RemoteRepoData } from './remote-release-client';
export interface GitLabRepoData extends RemoteRepoData {
    projectId: string;
}
export interface GitLabRelease {
    id?: string;
    name?: string;
    tag_name: string;
    ref: string;
    assets?: {
        links?: {
            name: string;
            url: string;
            direct_asset_path?: string;
            link_type?: string;
        }[];
    };
    released_at?: string;
    description?: string;
    milestones?: string[];
    prerelease?: boolean;
}
export declare const defaultCreateReleaseProvider: ResolvedCreateRemoteReleaseProvider;
export declare class GitLabRemoteReleaseClient extends RemoteReleaseClient<GitLabRelease> {
    remoteReleaseProviderName: string;
    /**
     * Get GitLab repository data from git remote
     */
    static resolveRepoData(createReleaseConfig: false | ResolvedCreateRemoteReleaseProvider, remoteName?: string): GitLabRepoData | null;
    /**
     * Resolve a GitLab token from various environment variables
     */
    static resolveTokenData(hostname: string): Promise<{
        token: string;
        headerName: string;
    } | null>;
    createPostGitTask(releaseVersion: ReleaseVersion, changelogContents: string, dryRun: boolean): PostGitTask;
    applyUsernameToAuthors(): Promise<void>;
    protected getReleaseByTag(tag: string): Promise<GitLabRelease>;
    protected createRelease(remoteRelease: GitLabRelease): Promise<any>;
    protected updateRelease(_id: string, remoteRelease: GitLabRelease): Promise<any>;
    /**
     * Generate a URL for manual release creation on GitLab. Sadly, unlike GitHub, GitLab does not
     * seem to respect query string parameters for setting the UI form fields, so the user has to
     * start from scratch.
     */
    protected getManualRemoteReleaseURL(_remoteReleaseOptions: RemoteReleaseOptions): string;
    protected handleAuthError(): void;
    protected logReleaseAction(existingRelease: GitLabRelease | undefined, gitTag: string, dryRun: boolean): void;
    protected handleError(error: any, result: RemoteReleaseResult): Promise<void>;
    private promptForContinueInGitLab;
    /**
     * Format references for the release (e.g., MRs, issues)
     */
    formatReferences(references: Reference[]): string;
    protected syncRelease(remoteReleaseOptions: RemoteReleaseOptions, existingRelease?: GitLabRelease): Promise<RemoteReleaseResult>;
    private getRequiredRemoteRepoData;
}
