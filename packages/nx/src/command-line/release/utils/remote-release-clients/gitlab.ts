import * as chalk from 'chalk';
import { prompt } from 'enquirer';
import { execSync } from 'node:child_process';
import { output } from '../../../../utils/output';
import type { PostGitTask } from '../../changelog';
import type { ResolvedCreateRemoteReleaseProvider } from '../../config/config';
import type { Reference } from '../git';
import { ReleaseVersion } from '../shared';
import {
  RemoteReleaseClient,
  RemoteReleaseOptions,
  RemoteReleaseResult,
  RemoteRepoData,
  RemoteRepoSlug,
} from './remote-release-client';

export interface GitLabRepoData extends RemoteRepoData {
  projectId: string;
}

// https://docs.gitlab.com/api/releases/#create-a-release
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

export const defaultCreateReleaseProvider: ResolvedCreateRemoteReleaseProvider =
  {
    provider: 'gitlab',
    hostname: 'gitlab.com',
    apiBaseUrl: 'https://gitlab.com/api/v4',
  };

export class GitLabRemoteReleaseClient extends RemoteReleaseClient<GitLabRelease> {
  remoteReleaseProviderName = 'GitLab';

  /**
   * Get GitLab repository data from git remote
   */
  static resolveRepoData(
    createReleaseConfig: false | ResolvedCreateRemoteReleaseProvider,
    remoteName = 'origin'
  ): GitLabRepoData | null {
    try {
      const remoteUrl = execSync(`git remote get-url ${remoteName}`, {
        encoding: 'utf8',
        stdio: 'pipe',
      }).trim();

      // Use the default provider if custom one is not specified or releases are disabled
      let hostname = defaultCreateReleaseProvider.hostname;
      let apiBaseUrl = defaultCreateReleaseProvider.apiBaseUrl;

      if (
        createReleaseConfig !== false &&
        typeof createReleaseConfig !== 'string'
      ) {
        hostname = createReleaseConfig.hostname || hostname;
        apiBaseUrl = createReleaseConfig.apiBaseUrl || apiBaseUrl;
      }

      // Extract the project path from the URL
      const escapedHostname = hostname.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regexString = `${escapedHostname}[/:]([\\w.-]+/[\\w.-]+(?:/[\\w.-]+)*)(\\.git)?`;
      const regex = new RegExp(regexString);
      const match = remoteUrl.match(regex);

      if (match && match[1]) {
        // Remove trailing .git if present
        const slug = match[1].replace(/\.git$/, '') as RemoteRepoSlug;

        // Encode the project path for use in API URLs
        const projectId = encodeURIComponent(slug);

        return {
          hostname,
          apiBaseUrl,
          slug,
          projectId,
        };
      } else {
        throw new Error(
          `Could not extract project path data from the resolved remote URL: ${remoteUrl}`
        );
      }
    } catch (err) {
      if (process.env.NX_VERBOSE_LOGGING === 'true') {
        console.error(err);
      }
      return null;
    }
  }

  /**
   * Resolve a GitLab token from various environment variables
   */
  static async resolveTokenData(
    hostname: string
  ): Promise<{ token: string; headerName: string } | null> {
    // Try and resolve from the environment
    const tokenFromEnv = process.env.GITLAB_TOKEN || process.env.GL_TOKEN;
    if (tokenFromEnv) {
      return { token: tokenFromEnv, headerName: 'PRIVATE-TOKEN' };
    }
    // Try and resolve from a CI environment
    if (process.env.CI_JOB_TOKEN) {
      return { token: process.env.CI_JOB_TOKEN, headerName: 'JOB-TOKEN' };
    }

    if (hostname !== 'gitlab.com') {
      console.log(
        `Warning: It was not possible to automatically resolve a GitLab token from your environment for hostname ${hostname}. If you set the GITLAB_TOKEN or GL_TOKEN environment variable (or you are in GitLab CI where CI_JOB_TOKEN is set automatically), that will be used for GitLab API requests.`
      );
    }
    return null;
  }

  createPostGitTask(
    releaseVersion: ReleaseVersion,
    changelogContents: string,
    dryRun: boolean
  ): PostGitTask {
    return async (latestCommit: string) => {
      output.logSingleLine(`Creating GitLab Release`);
      await this.createOrUpdateRelease(
        releaseVersion,
        changelogContents,
        latestCommit,
        { dryRun }
      );
    };
  }

  // Not implemented for GitLab yet, the changelog renderer should not call this method
  async applyUsernameToAuthors(): Promise<void> {
    throw new Error('applyUsernameToAuthors is not implemented for GitLab yet');
  }

  protected async getReleaseByTag(tag: string): Promise<GitLabRelease> {
    const gitlabRepoData = this.getRequiredRemoteRepoData();
    return await this.makeRequest(
      `/projects/${gitlabRepoData.projectId}/releases/${encodeURIComponent(
        tag
      )}`
    );
  }

  protected async createRelease(remoteRelease: GitLabRelease): Promise<any> {
    const gitlabRepoData = this.getRequiredRemoteRepoData();
    return await this.makeRequest(
      `/projects/${gitlabRepoData.projectId}/releases`,
      {
        method: 'POST',
        data: remoteRelease,
      }
    );
  }

  protected async updateRelease(
    _id: string,
    remoteRelease: GitLabRelease
  ): Promise<any> {
    const gitlabRepoData = this.getRequiredRemoteRepoData();
    return await this.makeRequest(
      `/projects/${gitlabRepoData.projectId}/releases/${encodeURIComponent(
        remoteRelease.tag_name
      )}`,
      {
        method: 'PUT',
        data: remoteRelease,
      }
    );
  }

  /**
   * Generate a URL for manual release creation on GitLab. Sadly, unlike GitHub, GitLab does not
   * seem to respect query string parameters for setting the UI form fields, so the user has to
   * start from scratch.
   */
  protected getManualRemoteReleaseURL(
    _remoteReleaseOptions: RemoteReleaseOptions
  ): string {
    const gitlabRepoData = this.getRequiredRemoteRepoData();
    return `https://${gitlabRepoData.hostname}/${gitlabRepoData.slug}/-/releases/new`;
  }

  protected handleAuthError(): void {
    output.error({
      title: `Unable to resolve data via the GitLab API.`,
      bodyLines: [
        '- Set the `GITLAB_TOKEN` or `GL_TOKEN` environment variable to a valid GitLab token with `api` scope',
        '- If running in GitLab CI, the automatically provisioned CI_JOB_TOKEN can also be used',
      ],
    });
  }

  protected logReleaseAction(
    existingRelease: GitLabRelease | undefined,
    gitTag: string,
    dryRun: boolean
  ): void {
    const gitlabRepoData = this.getRequiredRemoteRepoData();
    const logTitle = `https://${gitlabRepoData.hostname}/${
      gitlabRepoData.slug
    }/-/releases/${encodeURIComponent(gitTag)}`;
    if (existingRelease) {
      console.error(
        `${chalk.white('UPDATE')} ${logTitle}${
          dryRun ? chalk.keyword('orange')(' [dry-run]') : ''
        }`
      );
    } else {
      console.error(
        `${chalk.green('CREATE')} ${logTitle}${
          dryRun ? chalk.keyword('orange')(' [dry-run]') : ''
        }`
      );
    }
  }

  protected async handleError(
    error: any,
    result: RemoteReleaseResult
  ): Promise<void> {
    if (error) {
      process.exitCode = 1;

      if (error.response?.data) {
        output.error({
          title: `A GitLab API Error occurred when creating/updating the release`,
          bodyLines: [
            `GitLab Error: ${JSON.stringify(error.response.data)}`,
            `---`,
            `Request Data:`,
            `Repo: ${this.getRemoteRepoData<GitLabRepoData>()?.slug}`,
            `Token Header Data: ${this.tokenHeader}`,
            `Body: ${JSON.stringify(result.requestData)}`,
          ],
        });
      } else {
        console.log(error);
        console.error(
          `An unknown error occurred while trying to create a release on GitLab, please report this on https://github.com/nrwl/nx (NOTE: make sure to redact your GitLab token from the error message!)`
        );
      }
    }

    const shouldContinueInGitLab = await this.promptForContinueInGitLab();
    if (!shouldContinueInGitLab) {
      return;
    }

    const open = require('open');
    await open(result.url)
      .then(() => {
        console.info(
          `\nFollow up in the browser to manually create the release:\n\n` +
            chalk.underline(chalk.cyan(result.url)) +
            `\n`
        );
      })
      .catch(() => {
        console.info(
          `Open this link to manually create a release: \n` +
            chalk.underline(chalk.cyan(result.url)) +
            '\n'
        );
      });
  }

  private async promptForContinueInGitLab(): Promise<boolean> {
    try {
      const reply = await prompt<{ open: 'Yes' | 'No' }>([
        {
          name: 'open',
          message:
            'Do you want to create the release manually in your browser?',
          type: 'autocomplete',
          choices: [
            {
              name: 'Yes',
              hint: 'It will open the GitLab release page for you',
            },
            {
              name: 'No',
            },
          ],
          initial: 0,
        },
      ]);
      return reply.open === 'Yes';
    } catch {
      // Ensure the cursor is always restored before exiting
      process.stdout.write('\u001b[?25h');
      // Handle the case where the user exits the prompt with ctrl+c
      process.exit(1);
    }
  }

  /**
   * Format references for the release (e.g., MRs, issues)
   */
  formatReferences(references: Reference[]): string {
    const gitlabRepoData = this.getRequiredRemoteRepoData();
    const providerToRefSpec: Record<
      string,
      Record<Reference['type'], string>
    > = {
      gitlab: {
        'pull-request': 'merge_requests',
        hash: 'commit',
        issue: 'issues',
      },
    };

    const refSpec = providerToRefSpec.gitlab;

    const formatSingleReference = (ref: Reference) => {
      return `https://${gitlabRepoData.hostname}/${gitlabRepoData.slug}/-/${
        refSpec[ref.type]
      }/${ref.value.replace(/^[#!]/, '')}`;
    };

    const mr = references.filter((ref) => ref.type === 'pull-request');
    const issue = references.filter((ref) => ref.type === 'issue');

    if (mr.length > 0 || issue.length > 0) {
      return (
        ' (' +
        [...mr, ...issue].map((ref) => formatSingleReference(ref)).join(', ') +
        ')'
      );
    }

    if (references.length > 0) {
      return ' (' + formatSingleReference(references[0]) + ')';
    }

    return '';
  }

  protected async syncRelease(
    remoteReleaseOptions: RemoteReleaseOptions,
    existingRelease?: GitLabRelease
  ): Promise<RemoteReleaseResult> {
    const gitlabReleaseData: GitLabRelease = {
      tag_name: remoteReleaseOptions.version,
      name: remoteReleaseOptions.version,
      description: remoteReleaseOptions.body,
      prerelease: remoteReleaseOptions.prerelease,
      ref: remoteReleaseOptions.commit,
      released_at: new Date().toISOString(),
      assets: { links: [] },
      milestones: [],
    };

    try {
      const newGlRelease = await (existingRelease
        ? this.updateRelease(existingRelease.id, gitlabReleaseData)
        : this.createRelease(gitlabReleaseData));

      const gitlabRepoData = this.getRequiredRemoteRepoData();

      return {
        status: existingRelease ? 'updated' : 'created',
        id: newGlRelease.tag_name,
        url: `https://${gitlabRepoData.hostname}/${
          gitlabRepoData.slug
        }/-/tags/${encodeURIComponent(remoteReleaseOptions.version)}`,
      };
    } catch (error) {
      return {
        status: 'manual',
        error,
        url: this.getManualRemoteReleaseURL(remoteReleaseOptions),
        requestData: gitlabReleaseData,
      };
    }
  }

  private getRequiredRemoteRepoData(): GitLabRepoData {
    const gitlabRepoData = this.getRemoteRepoData<GitLabRepoData>();
    if (!gitlabRepoData) {
      throw new Error(
        `No remote repo data could be resolved for the current workspace`
      );
    }
    return gitlabRepoData;
  }
}
