import * as chalk from 'chalk';
import { prompt } from 'enquirer';
import { execSync } from 'node:child_process';
import { existsSync, promises as fsp } from 'node:fs';
import { homedir } from 'node:os';
import { output } from '../../../../utils/output';
import { joinPathFragments } from '../../../../utils/path';
import type { PostGitTask } from '../../changelog';
import { type ResolvedCreateRemoteReleaseProvider } from '../../config/config';
import { Reference } from '../git';
import { ReleaseVersion } from '../shared';
import {
  RemoteReleaseClient,
  RemoteReleaseOptions,
  RemoteReleaseResult,
  RemoteRepoData,
  RemoteRepoSlug,
} from './remote-release-client';

// axios types and values don't seem to match
import _axios = require('axios');
const axios = _axios as any as (typeof _axios)['default'];

export interface GithubRepoData extends RemoteRepoData {}

// https://docs.github.com/en/rest/releases/releases?apiVersion=2022-11-28#create-a-release--parameters
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

export const defaultCreateReleaseProvider: ResolvedCreateRemoteReleaseProvider =
  {
    provider: 'github',
    hostname: 'github.com',
    apiBaseUrl: 'https://api.github.com',
  };

export class GithubRemoteReleaseClient extends RemoteReleaseClient<GithubRemoteRelease> {
  remoteReleaseProviderName = 'GitHub';

  /**
   * Get GitHub repository data from git remote
   */
  static resolveRepoData(
    createReleaseConfig: false | ResolvedCreateRemoteReleaseProvider,
    remoteName = 'origin'
  ): GithubRepoData | null {
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
        hostname = createReleaseConfig.hostname;
        apiBaseUrl = createReleaseConfig.apiBaseUrl;
      }

      // Extract the 'user/repo' part from the `remoteUrl`, expecting the following formats:
      // - HTTPS: https://github.com/user/repo.git
      // - SSH: git@github.com:user/repo.git
      // - SSH over HTTPS: ssh://git@ssh.github.com:443/user/repo.git
      const escapedHostname = hostname.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regexString = `${escapedHostname}(?::\\d+)?[/:]([\\w.-]+/[\\w.-]+)(?:\\.git)?/?$`;
      const regex = new RegExp(regexString);
      const match = remoteUrl.match(regex);

      if (match && match[1]) {
        return {
          hostname,
          apiBaseUrl,
          // Ensure any trailing .git is stripped
          slug: match[1].replace(/\.git$/, '') as RemoteRepoSlug,
        };
      } else {
        throw new Error(
          `Could not extract "user/repo" data from the resolved remote URL: ${remoteUrl}`
        );
      }
    } catch (error) {
      return null;
    }
  }

  /**
   * Resolve a GitHub token from environment variables or gh CLI
   */
  static async resolveTokenData(
    hostname: string
  ): Promise<{ token: string; headerName: string } | null> {
    // Try and resolve from the environment
    const tokenFromEnv = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
    if (tokenFromEnv) {
      return { token: tokenFromEnv, headerName: 'Authorization' };
    }
    // Try and resolve from gh CLI installation
    const ghCLIPath = joinPathFragments(
      process.env.XDG_CONFIG_HOME || joinPathFragments(homedir(), '.config'),
      'gh',
      'hosts.yml'
    );
    if (existsSync(ghCLIPath)) {
      const yamlContents = await fsp.readFile(ghCLIPath, 'utf8');
      const { load } = require('@zkochan/js-yaml');
      const ghCLIConfig = load(yamlContents);
      if (ghCLIConfig[hostname]) {
        // Web based session (the token is already embedded in the config)
        if (ghCLIConfig[hostname].oauth_token) {
          return ghCLIConfig[hostname].oauth_token;
        }
        // SSH based session (we need to dynamically resolve a token using the CLI)
        if (
          ghCLIConfig[hostname].user &&
          ghCLIConfig[hostname].git_protocol === 'ssh'
        ) {
          const token = execSync(`gh auth token`, {
            encoding: 'utf8',
            stdio: 'pipe',
            windowsHide: false,
          }).trim();
          return { token, headerName: 'Authorization' };
        }
      }
    }
    if (hostname !== 'github.com') {
      console.log(
        `Warning: It was not possible to automatically resolve a GitHub token from your environment for hostname ${hostname}. If you set the GITHUB_TOKEN or GH_TOKEN environment variable, that will be used for GitHub API requests.`
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
      output.logSingleLine(`Creating GitHub Release`);
      await this.createOrUpdateRelease(
        releaseVersion,
        changelogContents,
        latestCommit,
        { dryRun }
      );
    };
  }

  async applyUsernameToAuthors(
    authors: Map<string, { email: Set<string>; username?: string }>
  ): Promise<void> {
    await Promise.all(
      [...authors.keys()].map(async (authorName) => {
        const meta = authors.get(authorName);
        for (const email of meta.email) {
          if (email.endsWith('@users.noreply.github.com')) {
            const match = email.match(
              /^(\d+\+)?([^@]+)@users\.noreply\.github\.com$/
            );
            if (match && match[2]) {
              meta.username = match[2];
              break;
            }
          }
          const { data } = await axios
            .get<any, { data?: { user?: { username: string } } }>(
              `https://ungh.cc/users/find/${email}`
            )
            .catch(() => ({ data: { user: null } }));
          if (data?.user) {
            meta.username = data.user.username;
            break;
          }
        }
      })
    );
  }

  /**
   * Get a release by tag
   */
  protected async getReleaseByTag(tag: string): Promise<GithubRemoteRelease> {
    const githubRepoData = this.getRequiredRemoteRepoData();
    return await this.makeRequest(
      `/repos/${githubRepoData.slug}/releases/tags/${tag}`
    );
  }

  /**
   * Create a new release
   */
  protected async createRelease(
    remoteRelease: GithubRemoteRelease
  ): Promise<any> {
    const githubRepoData = this.getRequiredRemoteRepoData();
    return await this.makeRequest(`/repos/${githubRepoData.slug}/releases`, {
      method: 'POST',
      data: remoteRelease,
    });
  }

  protected async updateRelease(
    id: string,
    remoteRelease: GithubRemoteRelease
  ): Promise<any> {
    const githubRepoData = this.getRequiredRemoteRepoData();
    return await this.makeRequest(
      `/repos/${githubRepoData.slug}/releases/${id}`,
      {
        method: 'PATCH',
        data: remoteRelease,
      }
    );
  }

  protected getManualRemoteReleaseURL(
    remoteReleaseOptions: RemoteReleaseOptions
  ): string {
    const githubRepoData = this.getRequiredRemoteRepoData();
    // Parameters taken from https://github.com/isaacs/github/issues/1410#issuecomment-442240267
    let url = `https://${githubRepoData.hostname}/${
      githubRepoData.slug
    }/releases/new?tag=${remoteReleaseOptions.version}&title=${
      remoteReleaseOptions.version
    }&body=${encodeURIComponent(remoteReleaseOptions.body)}&target=${
      remoteReleaseOptions.commit
    }`;
    if (remoteReleaseOptions.prerelease) {
      url += '&prerelease=true';
    }
    return url;
  }

  protected handleAuthError(): void {
    output.error({
      title: `Unable to resolve data via the GitHub API. You can use any of the following options to resolve this:`,
      bodyLines: [
        '- Set the `GITHUB_TOKEN` or `GH_TOKEN` environment variable to a valid GitHub token with `repo` scope',
        '- Have an active session via the official gh CLI tool (https://cli.github.com) in your current terminal',
      ],
    });
  }

  protected logReleaseAction(
    existingRelease: GithubRemoteRelease | undefined,
    gitTag: string,
    dryRun: boolean
  ): void {
    const githubRepoData = this.getRequiredRemoteRepoData();
    const logTitle = `https://${githubRepoData.hostname}/${githubRepoData.slug}/releases/tag/${gitTag}`;
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
        // There's a nicely formatted error from GitHub we can display to the user
        output.error({
          title: `A GitHub API Error occurred when creating/updating the release`,
          bodyLines: [
            `GitHub Error: ${JSON.stringify(error.response.data)}`,
            `---`,
            `Request Data:`,
            `Repo: ${this.getRemoteRepoData<GithubRepoData>()?.slug}`,
            `Token Header Data: ${this.tokenHeader}`,
            `Body: ${JSON.stringify(result.requestData)}`,
          ],
        });
      } else {
        console.log(error);
        console.error(
          `An unknown error occurred while trying to create a release on GitHub, please report this on https://github.com/nrwl/nx (NOTE: make sure to redact your GitHub token from the error message!)`
        );
      }
    }

    const shouldContinueInGitHub = await this.promptForContinueInGitHub();
    if (!shouldContinueInGitHub) {
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

  private async promptForContinueInGitHub(): Promise<boolean> {
    try {
      const reply = await prompt<{ open: 'Yes' | 'No' }>([
        {
          name: 'open',
          message:
            'Do you want to finish creating the release manually in your browser?',
          type: 'autocomplete',
          choices: [
            {
              name: 'Yes',
              hint: 'It will pre-populate the form for you',
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
   * Format references for the release (e.g., PRs, issues)
   */
  formatReferences(references: Reference[]): string {
    const githubRepoData = this.getRequiredRemoteRepoData();
    const providerToRefSpec: Record<
      string,
      Record<Reference['type'], string>
    > = {
      github: { 'pull-request': 'pull', hash: 'commit', issue: 'issues' },
    };

    const refSpec = providerToRefSpec.github;

    const formatSingleReference = (ref: Reference) => {
      return `[${ref.value}](https://${githubRepoData.hostname}/${
        githubRepoData.slug
      }/${refSpec[ref.type]}/${ref.value.replace(/^#/, '')})`;
    };

    const pr = references.filter((ref) => ref.type === 'pull-request');
    const issue = references.filter((ref) => ref.type === 'issue');

    if (pr.length > 0 || issue.length > 0) {
      return (
        ' (' +
        [...pr, ...issue].map((ref) => formatSingleReference(ref)).join(', ') +
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
    existingRelease?: GithubRemoteRelease
  ): Promise<RemoteReleaseResult> {
    const githubReleaseData: GithubRemoteRelease = {
      tag_name: remoteReleaseOptions.version,
      name: remoteReleaseOptions.version,
      body: remoteReleaseOptions.body,
      prerelease: remoteReleaseOptions.prerelease,
      // legacy specifies that the latest release should be determined based on the release creation date and higher semantic version.
      make_latest: 'legacy',
    };

    try {
      const newGhRelease = await (existingRelease
        ? this.updateRelease(existingRelease.id, githubReleaseData)
        : this.createRelease({
            ...githubReleaseData,
            target_commitish: remoteReleaseOptions.commit,
          }));

      return {
        status: existingRelease ? 'updated' : 'created',
        id: newGhRelease.id,
        url: newGhRelease.html_url,
      };
    } catch (error) {
      return {
        status: 'manual',
        error,
        url: this.getManualRemoteReleaseURL(remoteReleaseOptions),
        requestData: githubReleaseData,
      };
    }
  }

  private getRequiredRemoteRepoData(): GithubRepoData {
    const githubRepoData = this.getRemoteRepoData<GithubRepoData>();
    if (!githubRepoData) {
      throw new Error(
        `No remote repo data could be resolved for the current workspace`
      );
    }
    return githubRepoData;
  }
}
