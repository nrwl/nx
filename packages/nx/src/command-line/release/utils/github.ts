/**
 * Special thanks to changelogen for the original inspiration for many of these utilities:
 * https://github.com/unjs/changelogen
 */
import type { AxiosRequestConfig } from 'axios';
import * as chalk from 'chalk';
import { execSync } from 'node:child_process';
import { existsSync, promises as fsp } from 'node:fs';
import { homedir } from 'node:os';
import { joinPathFragments, output } from '../../../devkit-exports';
import { Reference } from './git';

// axios types and values don't seem to match
import _axios = require('axios');
const axios = _axios as any as typeof _axios['default'];

export type RepoSlug = `${string}/${string}`;

export interface GithubRequestConfig {
  repo: string;
  token: string | null;
}

export interface GithubRelease {
  id?: string;
  tag_name: string;
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
  githubRequestConfig: GithubRequestConfig,
  release: { version: string; body: string; prerelease: boolean },
  existingGithubReleaseForVersion?: GithubRelease
) {
  const result = await syncGithubRelease(
    githubRequestConfig,
    release,
    existingGithubReleaseForVersion
  );
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

async function syncGithubRelease(
  githubRequestConfig: GithubRequestConfig,
  release: { version: string; body: string; prerelease: boolean },
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
      : createGithubRelease(githubRequestConfig, ghRelease));
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
    return ghCLIConfig['github.com'].oauth_token;
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
  return `https://github.com/${config.repo}/releases/new?tag=v${
    release.version
  }&title=v${release.version}&body=${encodeURIComponent(release.body)}`;
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
