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
import { output } from '../../../utils/output';
import { joinPathFragments } from '../../../utils/path';
import { Reference } from './git';
import { printDiff } from './print-changes';
import { ReleaseVersion, noDiffInChangelogMessage } from './shared';

// axios types and values don't seem to match
import _axios = require('axios');
const axios = _axios as any as (typeof _axios)['default'];

export type RepoSlug = `${string}/${string}`;

export interface GithubRequestConfig {
  repo: string;
  token: string | null;
}

export interface GithubRelease {
  id?: string;
  tag_name: string;
  target_commitish?: string;
  name?: string;
  body?: string;
  draft?: boolean;
  prerelease?: boolean;
}

export function getGitHubRepoSlug(remoteName = 'origin'): RepoSlug {
  try {
    const remoteUrl = execSync(`git remote get-url ${remoteName}`, {
      encoding: 'utf8',
      stdio: 'pipe',
    }).trim();

    // Extract the 'user/repo' part from the URL
    const regex = /github\.com[/:]([\w-]+\/[\w-]+)/;
    const match = remoteUrl.match(regex);

    if (match && match[1]) {
      return match[1] as RepoSlug;
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
  releaseVersion: ReleaseVersion,
  changelogContents: string,
  latestCommit: string,
  { dryRun }: { dryRun: boolean }
): Promise<void> {
  const githubRepoSlug = getGitHubRepoSlug();
  if (!githubRepoSlug) {
    output.error({
      title: `Unable to create a GitHub release because the GitHub repo slug could not be determined.`,
      bodyLines: [
        `Please ensure you have a valid GitHub remote configured. You can run \`git remote -v\` to list your current remotes.`,
      ],
    });
    process.exit(1);
  }

  const token = await resolveGithubToken();
  const githubRequestConfig: GithubRequestConfig = {
    repo: githubRepoSlug,
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

  const logTitle = `https://github.com/${githubRepoSlug}/releases/tag/${releaseVersion.gitTag}`;
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

export async function resolveGithubToken(): Promise<string | null> {
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
    if (ghCLIConfig['github.com']) {
      // Web based session (the token is already embedded in the config)
      if (ghCLIConfig['github.com'].oauth_token) {
        return ghCLIConfig['github.com'].oauth_token;
      }
      // SSH based session (we need to dynamically resolve a token using the CLI)
      if (
        ghCLIConfig['github.com'].user &&
        ghCLIConfig['github.com'].git_protocol === 'ssh'
      ) {
        return execSync(`gh auth token`, {
          encoding: 'utf8',
          stdio: 'pipe',
        }).trim();
      }
    }
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
      baseURL: 'https://api.github.com',
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
  release: { version: string; body: string }
) {
  return `https://github.com/${config.repo}/releases/new?tag=${
    release.version
  }&title=${release.version}&body=${encodeURIComponent(release.body)}`;
}

type RepoProvider = 'github';

const providerToRefSpec: Record<
  RepoProvider,
  Record<Reference['type'], string>
> = {
  github: { 'pull-request': 'pull', hash: 'commit', issue: 'issues' },
};

function formatReference(ref: Reference, repoSlug: `${string}/${string}`) {
  const refSpec = providerToRefSpec['github'];
  return `[${ref.value}](https://github.com/${repoSlug}/${
    refSpec[ref.type]
  }/${ref.value.replace(/^#/, '')})`;
}

export function formatReferences(references: Reference[], repoSlug: RepoSlug) {
  const pr = references.filter((ref) => ref.type === 'pull-request');
  const issue = references.filter((ref) => ref.type === 'issue');
  if (pr.length > 0 || issue.length > 0) {
    return (
      ' (' +
      [...pr, ...issue]
        .map((ref) => formatReference(ref, repoSlug))
        .join(', ') +
      ')'
    );
  }
  if (references.length > 0) {
    return ' (' + formatReference(references[0], repoSlug) + ')';
  }
  return '';
}
