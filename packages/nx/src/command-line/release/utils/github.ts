/**
 * Special thanks to changelogen for the original inspiration for many of these utilities:
 * https://github.com/unjs/changelogen
 */
import type { AxiosRequestConfig } from 'axios';
import * as chalk from 'chalk';
import { prompt } from 'enquirer';
import { execSync } from 'node:child_process';
import { existsSync, promises as fsp } from 'node:fs';
import { homedir } from 'node:os';
import { NxReleaseChangelogConfiguration } from '../../../config/nx-json';
import { output } from '../../../utils/output';
import { joinPathFragments } from '../../../utils/path';
import { defaultCreateReleaseProvider } from '../config/config';
import { Reference } from './git';
import { printDiff } from './print-changes';
import { ReleaseVersion, noDiffInChangelogMessage } from './shared';

// axios types and values don't seem to match
import _axios = require('axios');
const axios = _axios as any as (typeof _axios)['default'];

export type RepoSlug = `${string}/${string}`;

interface GithubRequestConfig {
  repo: string;
  hostname: string;
  apiBaseUrl: string;
  token: string | null;
}

interface GithubRelease {
  id?: string;
  tag_name: string;
  target_commitish?: string;
  name?: string;
  body?: string;
  draft?: boolean;
  prerelease?: boolean;
}

export interface GithubRepoData {
  hostname: string;
  slug: RepoSlug;
  apiBaseUrl: string;
}

export function getGitHubRepoData(
  remoteName = 'origin',
  createReleaseConfig: NxReleaseChangelogConfiguration['createRelease']
): GithubRepoData | null {
  try {
    const remoteUrl = execSync(`git remote get-url ${remoteName}`, {
      encoding: 'utf8',
      stdio: 'pipe',
    }).trim();

    // Use the default provider (github.com) if custom one is not specified or releases are disabled
    let hostname = defaultCreateReleaseProvider.hostname;
    let apiBaseUrl = defaultCreateReleaseProvider.apiBaseUrl;
    if (
      createReleaseConfig !== false &&
      typeof createReleaseConfig !== 'string'
    ) {
      hostname = createReleaseConfig.hostname;
      apiBaseUrl = createReleaseConfig.apiBaseUrl;
    }

    // Extract the 'user/repo' part from the URL
    const escapedHostname = hostname.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regexString = `${escapedHostname}[/:]([\\w.-]+/[\\w.-]+)(\\.git)?`;
    const regex = new RegExp(regexString);
    const match = remoteUrl.match(regex);

    if (match && match[1]) {
      return {
        hostname,
        apiBaseUrl,
        // Ensure any trailing .git is stripped
        slug: match[1].replace(/\.git$/, '') as RepoSlug,
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

export async function createOrUpdateGithubRelease(
  createReleaseConfig: NxReleaseChangelogConfiguration['createRelease'],
  releaseVersion: ReleaseVersion,
  changelogContents: string,
  latestCommit: string,
  { dryRun }: { dryRun: boolean }
): Promise<void> {
  const githubRepoData = getGitHubRepoData(undefined, createReleaseConfig);
  if (!githubRepoData) {
    output.error({
      title: `Unable to create a GitHub release because the GitHub repo slug could not be determined.`,
      bodyLines: [
        `Please ensure you have a valid GitHub remote configured. You can run \`git remote -v\` to list your current remotes.`,
      ],
    });
    process.exit(1);
  }

  const token = await resolveGithubToken(githubRepoData.hostname);
  const githubRequestConfig: GithubRequestConfig = {
    repo: githubRepoData.slug,
    hostname: githubRepoData.hostname,
    apiBaseUrl: githubRepoData.apiBaseUrl,
    token,
  };

  let existingGithubReleaseForVersion: GithubRelease;
  try {
    existingGithubReleaseForVersion = await getGithubReleaseByTag(
      githubRequestConfig,
      releaseVersion.gitTag
    );
  } catch (err) {
    if (err.response?.status === 401) {
      output.error({
        title: `Unable to resolve data via the GitHub API. You can use any of the following options to resolve this:`,
        bodyLines: [
          '- Set the `GITHUB_TOKEN` or `GH_TOKEN` environment variable to a valid GitHub token with `repo` scope',
          '- Have an active session via the official gh CLI tool (https://cli.github.com) in your current terminal',
        ],
      });
      process.exit(1);
    }
    if (err.response?.status === 404) {
      // No existing release found, this is fine
    } else {
      // Rethrow unknown errors for now
      throw err;
    }
  }

  const logTitle = `https://${githubRepoData.hostname}/${githubRepoData.slug}/releases/tag/${releaseVersion.gitTag}`;
  if (existingGithubReleaseForVersion) {
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

  console.log('');
  printDiff(
    existingGithubReleaseForVersion ? existingGithubReleaseForVersion.body : '',
    changelogContents,
    3,
    noDiffInChangelogMessage
  );

  if (!dryRun) {
    await createOrUpdateGithubReleaseInternal(
      githubRequestConfig,
      {
        version: releaseVersion.gitTag,
        prerelease: releaseVersion.isPrerelease,
        body: changelogContents,
        commit: latestCommit,
      },
      existingGithubReleaseForVersion
    );
  }
}

interface GithubReleaseOptions {
  version: string;
  body: string;
  prerelease: boolean;
  commit: string;
}

async function createOrUpdateGithubReleaseInternal(
  githubRequestConfig: GithubRequestConfig,
  release: GithubReleaseOptions,
  existingGithubReleaseForVersion?: GithubRelease
) {
  const result = await syncGithubRelease(
    githubRequestConfig,
    release,
    existingGithubReleaseForVersion
  );

  /**
   * If something went wrong POSTing to Github we can still pre-populate the web form on github.com
   * to allow the user to manually complete the release if they so choose.
   */
  if (result.status === 'manual') {
    if (result.error) {
      process.exitCode = 1;

      if (result.error.response?.data) {
        // There's a nicely formatted error from GitHub we can display to the user
        output.error({
          title: `A GitHub API Error occurred when creating/updating the release`,
          bodyLines: [
            `GitHub Error: ${JSON.stringify(result.error.response.data)}`,
            `---`,
            `Request Data:`,
            `Repo: ${githubRequestConfig.repo}`,
            `Token: ${githubRequestConfig.token}`,
            `Body: ${JSON.stringify(result.requestData)}`,
          ],
        });
      } else {
        console.log(result.error);
        console.error(
          `An unknown error occurred while trying to create a release on GitHub, please report this on https://github.com/nrwl/nx (NOTE: make sure to redact your GitHub token from the error message!)`
        );
      }
    }

    const shouldContinueInGitHub = await promptForContinueInGitHub();
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

  /**
   * If something went wrong POSTing to Github we can still pre-populate the web form on github.com
   * to allow the user to manually complete the release.
   */
  if (result.status === 'manual') {
    if (result.error) {
      console.error(result.error);
      process.exitCode = 1;
    }
    const open = require('open');
    await open(result.url)
      .then(() => {
        console.info(
          `Follow up in the browser to manually create the release.`
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
}

async function promptForContinueInGitHub(): Promise<boolean> {
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
  } catch (e) {
    // Handle the case where the user exits the prompt with ctrl+c
    process.exit(1);
  }
}

async function syncGithubRelease(
  githubRequestConfig: GithubRequestConfig,
  release: GithubReleaseOptions,
  existingGithubReleaseForVersion?: GithubRelease
) {
  const ghRelease: GithubRelease = {
    tag_name: release.version,
    name: release.version,
    body: release.body,
    prerelease: release.prerelease,
  };

  try {
    const newGhRelease = await (existingGithubReleaseForVersion
      ? updateGithubRelease(
          githubRequestConfig,
          existingGithubReleaseForVersion.id,
          ghRelease
        )
      : createGithubRelease(githubRequestConfig, {
          ...ghRelease,
          target_commitish: release.commit,
        }));
    return {
      status: existingGithubReleaseForVersion ? 'updated' : 'created',
      id: newGhRelease.id,
      url: newGhRelease.html_url,
    };
  } catch (error) {
    return {
      status: 'manual',
      error,
      url: githubNewReleaseURL(githubRequestConfig, release),
      requestData: ghRelease,
    };
  }
}

async function resolveGithubToken(hostname: string): Promise<string | null> {
  // Try and resolve from the environment
  const tokenFromEnv = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (tokenFromEnv) {
    return tokenFromEnv;
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
        return execSync(`gh auth token`, {
          encoding: 'utf8',
          stdio: 'pipe',
          windowsHide: true,
        }).trim();
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

export async function getGithubReleaseByTag(
  config: GithubRequestConfig,
  tag: string
): Promise<GithubRelease> {
  return await makeGithubRequest(
    config,
    `/repos/${config.repo}/releases/tags/${tag}`,
    {}
  );
}

async function makeGithubRequest(
  config: GithubRequestConfig,
  url: string,
  opts: AxiosRequestConfig = {}
) {
  return (
    await axios<any, any>(url, {
      ...opts,
      baseURL: config.apiBaseUrl,
      headers: {
        ...(opts.headers as any),
        Authorization: config.token ? `Bearer ${config.token}` : undefined,
      },
    })
  ).data;
}

async function createGithubRelease(
  config: GithubRequestConfig,
  body: GithubRelease
) {
  return await makeGithubRequest(config, `/repos/${config.repo}/releases`, {
    method: 'POST',
    data: body,
  });
}

async function updateGithubRelease(
  config: GithubRequestConfig,
  id: string,
  body: GithubRelease
) {
  return await makeGithubRequest(
    config,
    `/repos/${config.repo}/releases/${id}`,
    {
      method: 'PATCH',
      data: body,
    }
  );
}

function githubNewReleaseURL(
  config: GithubRequestConfig,
  release: GithubReleaseOptions
) {
  // Parameters taken from https://github.com/isaacs/github/issues/1410#issuecomment-442240267
  let url = `https://${config.hostname}/${config.repo}/releases/new?tag=${
    release.version
  }&title=${release.version}&body=${encodeURIComponent(release.body)}&target=${
    release.commit
  }`;
  if (release.prerelease) {
    url += '&prerelease=true';
  }
  return url;
}

type RepoProvider = 'github';

const providerToRefSpec: Record<
  RepoProvider,
  Record<Reference['type'], string>
> = {
  github: { 'pull-request': 'pull', hash: 'commit', issue: 'issues' },
};

function formatReference(ref: Reference, repoData: GithubRepoData) {
  const refSpec = providerToRefSpec['github'];
  return `[${ref.value}](https://${repoData.hostname}/${repoData.slug}/${
    refSpec[ref.type]
  }/${ref.value.replace(/^#/, '')})`;
}

export function formatReferences(
  references: Reference[],
  repoData: GithubRepoData
) {
  const pr = references.filter((ref) => ref.type === 'pull-request');
  const issue = references.filter((ref) => ref.type === 'issue');
  if (pr.length > 0 || issue.length > 0) {
    return (
      ' (' +
      [...pr, ...issue]
        .map((ref) => formatReference(ref, repoData))
        .join(', ') +
      ')'
    );
  }
  if (references.length > 0) {
    return ' (' + formatReference(references[0], repoData) + ')';
  }
  return '';
}
