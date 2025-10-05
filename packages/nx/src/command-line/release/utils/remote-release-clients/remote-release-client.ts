import type { AxiosRequestConfig } from 'axios';
import axios from 'axios';
import type { PostGitTask } from '../../changelog';
import { ResolvedCreateRemoteReleaseProvider } from '../../config/config';
import type { Reference } from '../git';
import { printDiff } from '../print-changes';
import { noDiffInChangelogMessage, type ReleaseVersion } from '../shared';
import type { GithubRemoteReleaseClient } from './github';
import type { GitLabRemoteReleaseClient } from './gitlab';

export type RemoteRepoSlug = `${string}/${string}`;

// Base repository data interface
export interface RemoteRepoData {
  hostname: string;
  slug: RemoteRepoSlug;
  apiBaseUrl: string;
}

// Release options for creating or updating releases
export interface RemoteReleaseOptions {
  version: string;
  body: string;
  prerelease: boolean;
  commit: string;
}

// Release creation result
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
export abstract class RemoteReleaseClient<
  RemoteRelease extends Record<string, any>
> {
  /**
   * Used in user-facing messaging
   */
  abstract remoteReleaseProviderName: string;
  protected tokenHeader: Record<string, string>;

  constructor(
    // A workspace isn't guaranteed to have a remote
    private remoteRepoData: RemoteRepoData | null,
    protected createReleaseConfig: false | ResolvedCreateRemoteReleaseProvider,
    protected tokenData: { token: string; headerName: string } | null
  ) {
    this.tokenHeader = {};
    if (tokenData) {
      if (tokenData.headerName === 'Authorization') {
        this.tokenHeader[tokenData.headerName] = `Bearer ${tokenData.token}`;
      } else {
        this.tokenHeader[tokenData.headerName] = tokenData.token;
      }
    }
  }

  getRemoteRepoData<T extends RemoteRepoData>(): T | null {
    return this.remoteRepoData as T | null;
  }

  /**
   * Create a post git task that will be executed by nx release changelog after performing any relevant
   * git operations, if the user has opted into remote release creation.
   */
  abstract createPostGitTask(
    releaseVersion: ReleaseVersion,
    changelogContents: string,
    dryRun: boolean
  ): PostGitTask;

  /**
   * Apply authors' corresponding usernames, if applicable, on the remote release provider. It is designed to be
   * invoked by a changelog renderer implementation.
   */
  abstract applyUsernameToAuthors(
    authors: Map<string, { email: Set<string>; username?: string }>
  ): Promise<void>;

  /**
   * Make an (optionally authenticated) API request to the remote release provider
   */
  protected async makeRequest(
    url: string,
    opts: AxiosRequestConfig = {}
  ): Promise<any> {
    const remoteRepoData = this.getRemoteRepoData<RemoteRepoData>();
    if (!remoteRepoData) {
      throw new Error(
        `No remote repo data could be resolved for the current workspace`
      );
    }
    const config: AxiosRequestConfig<any> = {
      ...opts,
      baseURL: remoteRepoData.apiBaseUrl,
      headers: {
        ...(opts.headers as any),
        ...this.tokenHeader,
      },
    };
    return (await axios<any, any>(url, config)).data;
  }

  async createOrUpdateRelease(
    releaseVersion: ReleaseVersion,
    changelogContents: string,
    latestCommit: string,
    { dryRun }: { dryRun: boolean }
  ): Promise<void> {
    let existingRelease: RemoteRelease | undefined;

    try {
      existingRelease = await this.getReleaseByTag(releaseVersion.gitTag);
    } catch (err) {
      if (err.response?.status === 401) {
        this.handleAuthError();
        process.exit(1);
      }
      if (err.response?.status === 404) {
        // No existing release found, this is fine
      } else {
        // Rethrow unknown errors for now
        throw err;
      }
    }

    this.logReleaseAction(existingRelease, releaseVersion.gitTag, dryRun);

    this.printRemoteReleaseContents(
      existingRelease
        ? 'body' in existingRelease
          ? existingRelease.body
          : 'description' in existingRelease
          ? existingRelease.description
          : ''
        : '',
      changelogContents
    );

    if (!dryRun) {
      const remoteReleaseOptions: RemoteReleaseOptions = {
        version: releaseVersion.gitTag,
        prerelease: releaseVersion.isPrerelease,
        body: changelogContents,
        commit: latestCommit,
      };
      const result = await this.syncRelease(
        remoteReleaseOptions,
        existingRelease
      );
      if (result.status === 'manual') {
        await this.handleError(result.error, result);
      }
    }
  }

  /**
   * Format references for the release (e.g., PRs, issues)
   */
  formatReferences(_references: Reference[]): string {
    // Base implementation - to be overridden by specific providers
    return '';
  }

  /**
   * Handle non-auth related errors when creating releases
   */
  protected abstract handleError(
    error: any,
    result: RemoteReleaseResult
  ): Promise<void>;

  /**
   * Display authentication error message
   */
  protected abstract handleAuthError(): void;

  /**
   * Log the release action (create or update)
   */
  protected abstract logReleaseAction(
    existingRelease: RemoteRelease | undefined,
    gitTag: string,
    dryRun: boolean
  ): void;

  /**
   * Print changelog changes
   */
  protected printRemoteReleaseContents(
    existingBody: string,
    newBody: string
  ): void {
    console.log('');
    printDiff(existingBody, newBody, 3, noDiffInChangelogMessage);
  }

  /**
   * Get a release by tag
   */
  protected abstract getReleaseByTag(tag: string): Promise<RemoteRelease>;

  /**
   * Create a manual release URL used to create/edit a release in the remote release provider's UI
   */
  protected abstract getManualRemoteReleaseURL(
    remoteReleaseOptions: RemoteReleaseOptions
  ): string;

  /**
   * Create a new release
   */
  protected abstract createRelease(body: RemoteRelease): Promise<any>;

  /**
   * Update an existing release
   */
  protected abstract updateRelease(
    id: string,
    body: RemoteRelease
  ): Promise<any>;

  /**
   * Synchronize a release with the remote release provider
   */
  protected abstract syncRelease(
    remoteReleaseOptions: RemoteReleaseOptions,
    existingRelease?: RemoteRelease
  ): Promise<RemoteReleaseResult>;
}

/**
 * Factory function to create a remote release client based on the given configuration
 */
export async function createRemoteReleaseClient(
  createReleaseConfig: false | ResolvedCreateRemoteReleaseProvider,
  remoteName = 'origin'
): Promise<GithubRemoteReleaseClient | GitLabRemoteReleaseClient | null> {
  switch (true) {
    // GitHub and GitHub Enterprise Server
    case typeof createReleaseConfig === 'object' &&
      (createReleaseConfig.provider === 'github-enterprise-server' ||
        createReleaseConfig.provider === 'github'):
    // If remote releases are disabled, assume GitHub repo data resolution (but don't attempt to resolve a token) to match existing behavior
    case createReleaseConfig === false: {
      const { GithubRemoteReleaseClient } = await import('./github');
      const repoData = GithubRemoteReleaseClient.resolveRepoData(
        createReleaseConfig,
        remoteName
      );
      const token =
        createReleaseConfig && repoData
          ? await GithubRemoteReleaseClient.resolveTokenData(repoData.hostname)
          : null;
      return new GithubRemoteReleaseClient(
        repoData,
        createReleaseConfig,
        token
      );
    }
    // GitLab
    case typeof createReleaseConfig === 'object' &&
      createReleaseConfig.provider === 'gitlab': {
      const { GitLabRemoteReleaseClient } = await import('./gitlab');
      const repoData = GitLabRemoteReleaseClient.resolveRepoData(
        createReleaseConfig,
        remoteName
      );
      const tokenData = repoData
        ? await GitLabRemoteReleaseClient.resolveTokenData(repoData.hostname)
        : null;
      return new GitLabRemoteReleaseClient(
        repoData,
        createReleaseConfig,
        tokenData
      );
    }
    default:
      throw new Error(
        `Unsupported remote release configuration: ${JSON.stringify(
          createReleaseConfig
        )}`
      );
  }
}
