import type { PostGitTask } from '../../changelog';
import { type ResolvedCreateRemoteReleaseProvider } from '../../config/config';
import { Reference } from '../git';
import { ReleaseVersion } from '../shared';
import { RemoteReleaseClient, RemoteReleaseOptions, RemoteReleaseResult, RemoteRepoData } from './remote-release-client';
export interface GithubRepoData extends RemoteRepoData {
}
export interface GithubRemoteRelease {
    id?: string;
    body: string;
    tag_name: string;
    target_commitish?: string;
    name?: string;
    draft?: boolean;
    prerelease?: boolean;
    make_latest?: 'legacy' | boolean;
}
export declare const defaultCreateReleaseProvider: ResolvedCreateRemoteReleaseProvider;
export declare class GithubRemoteReleaseClient extends RemoteReleaseClient<GithubRemoteRelease> {
    remoteReleaseProviderName: string;
    /**
     * Get GitHub repository data from git remote
     */
    static resolveRepoData(createReleaseConfig: false | ResolvedCreateRemoteReleaseProvider, remoteName?: string): GithubRepoData | null;
    /**
     * Resolve a GitHub token from environment variables or gh CLI
     */
    static resolveTokenData(hostname: string): Promise<{
        token: string;
        headerName: string;
    } | null>;
    createPostGitTask(releaseVersion: ReleaseVersion, changelogContents: string, dryRun: boolean): PostGitTask;
    applyUsernameToAuthors(authors: Map<string, {
        email: Set<string>;
        username?: string;
    }>): Promise<void>;
    private resolveUsernameFromGhCli;
    /**
     * Get a release by tag
     */
    protected getReleaseByTag(tag: string): Promise<GithubRemoteRelease>;
    /**
     * Create a new release
     */
    protected createRelease(remoteRelease: GithubRemoteRelease): Promise<any>;
    protected updateRelease(id: string, remoteRelease: GithubRemoteRelease): Promise<any>;
    protected getManualRemoteReleaseURL(remoteReleaseOptions: RemoteReleaseOptions): string;
    protected handleAuthError(): void;
    protected logReleaseAction(existingRelease: GithubRemoteRelease | undefined, gitTag: string, dryRun: boolean): void;
    protected handleError(error: any, result: RemoteReleaseResult): Promise<void>;
    private promptForContinueInGitHub;
    /**
     * Format references for the release (e.g., PRs, issues)
     */
    formatReferences(references: Reference[]): string;
    protected syncRelease(remoteReleaseOptions: RemoteReleaseOptions, existingRelease?: GithubRemoteRelease): Promise<RemoteReleaseResult>;
    private getRequiredRemoteRepoData;
}
