import type { AxiosRequestConfig } from 'axios';
import type { PostGitTask } from '../../changelog';
import { ResolvedCreateRemoteReleaseProvider } from '../../config/config';
import type { Reference } from '../git';
import { type ReleaseVersion } from '../shared';
import type { GithubRemoteReleaseClient } from './github';
import type { GitLabRemoteReleaseClient } from './gitlab';
export type RemoteRepoSlug = `${string}/${string}`;
export interface RemoteRepoData {
    hostname: string;
    slug: RemoteRepoSlug;
    apiBaseUrl: string;
}
export interface RemoteReleaseOptions {
    version: string;
    body: string;
    prerelease: boolean;
    commit: string;
}
export interface RemoteReleaseResult {
    status: 'created' | 'updated' | 'manual';
    id?: string;
    url?: string;
    error?: any;
    requestData?: any;
}
/**
 * Abstract base class for remote release clients
 */
export declare abstract class RemoteReleaseClient<RemoteRelease extends Record<string, any>> {
    private remoteRepoData;
    protected createReleaseConfig: false | ResolvedCreateRemoteReleaseProvider;
    protected tokenData: {
        token: string;
        headerName: string;
    } | null;
    /**
     * Used in user-facing messaging
     */
    abstract remoteReleaseProviderName: string;
    protected tokenHeader: Record<string, string>;
    constructor(remoteRepoData: RemoteRepoData | null, createReleaseConfig: false | ResolvedCreateRemoteReleaseProvider, tokenData: {
        token: string;
        headerName: string;
    } | null);
    getRemoteRepoData<T extends RemoteRepoData>(): T | null;
    /**
     * Create a post git task that will be executed by nx release changelog after performing any relevant
     * git operations, if the user has opted into remote release creation.
     */
    abstract createPostGitTask(releaseVersion: ReleaseVersion, changelogContents: string, dryRun: boolean): PostGitTask;
    /**
     * Apply authors' corresponding usernames, if applicable, on the remote release provider. It is designed to be
     * invoked by a changelog renderer implementation.
     */
    abstract applyUsernameToAuthors(authors: Map<string, {
        email: Set<string>;
        username?: string;
    }>): Promise<void>;
    /**
     * Make an (optionally authenticated) API request to the remote release provider
     */
    protected makeRequest(url: string, opts?: AxiosRequestConfig): Promise<any>;
    createOrUpdateRelease(releaseVersion: ReleaseVersion, changelogContents: string, latestCommit: string, { dryRun }: {
        dryRun: boolean;
    }): Promise<void>;
    /**
     * Format references for the release (e.g., PRs, issues)
     */
    formatReferences(_references: Reference[]): string;
    /**
     * Handle non-auth related errors when creating releases
     */
    protected abstract handleError(error: any, result: RemoteReleaseResult): Promise<void>;
    /**
     * Display authentication error message
     */
    protected abstract handleAuthError(): void;
    /**
     * Log the release action (create or update)
     */
    protected abstract logReleaseAction(existingRelease: RemoteRelease | undefined, gitTag: string, dryRun: boolean): void;
    /**
     * Print changelog changes
     */
    protected printRemoteReleaseContents(existingBody: string, newBody: string): void;
    /**
     * Get a release by tag
     */
    protected abstract getReleaseByTag(tag: string): Promise<RemoteRelease>;
    /**
     * Create a manual release URL used to create/edit a release in the remote release provider's UI
     */
    protected abstract getManualRemoteReleaseURL(remoteReleaseOptions: RemoteReleaseOptions): string;
    /**
     * Create a new release
     */
    protected abstract createRelease(body: RemoteRelease): Promise<any>;
    /**
     * Update an existing release
     */
    protected abstract updateRelease(id: string, body: RemoteRelease): Promise<any>;
    /**
     * Synchronize a release with the remote release provider
     */
    protected abstract syncRelease(remoteReleaseOptions: RemoteReleaseOptions, existingRelease?: RemoteRelease): Promise<RemoteReleaseResult>;
}
/**
 * Factory function to create a remote release client based on the given configuration
 */
export declare function createRemoteReleaseClient(createReleaseConfig: false | ResolvedCreateRemoteReleaseProvider, remoteName?: string): Promise<GithubRemoteReleaseClient | GitLabRemoteReleaseClient | null>;
