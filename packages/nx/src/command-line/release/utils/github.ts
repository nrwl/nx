/**
 * Special thanks to changelogen for the original inspiration for many of these utilities:
 * https://github.com/unjs/changelogen
 */
import * as chalk from 'chalk';
import { execSync } from 'node:child_process';
import { existsSync, promises as fsp } from 'node:fs';
import { homedir } from 'node:os';
import { joinPathFragments, output } from '../../../devkit-exports';
import { GitCommit, Reference } from './git';

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

export function getGitHubRemote(remoteName = 'origin') {
  try {
    const remoteUrl = execSync(`git remote get-url ${remoteName}`, {
      encoding: 'utf8',
    }).trim();

    // Extract the 'user/repo' part from the URL
    const regex = /github\.com[/:]([\w-]+\/[\w-]+)\.git/;
    const match = remoteUrl.match(regex);

    if (match && match[1]) {
      return match[1];
    } else {
      throw new Error(
        `Could not extract "user/repo" data from the resolved remote URL: ${remoteUrl}`
      );
    }
  } catch (error) {
    console.error('Error getting GitHub remote:', error.message);
    return null;
  }
}

export async function createOrUpdateGithubRelease(
  githubRequestConfig: GithubRequestConfig,
  release: { version: string; body: string },
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
  } else {
    output.success({
      title: `Successfully ${
        existingGithubReleaseForVersion ? 'updated' : 'created'
      } release ${chalk.bold(release.version)} on Github:`,
      bodyLines: [result.url],
    });
  }
}

// TODO: allow this to be configurable via config in a future release
export async function generateMarkdown(
  commits: GitCommit[],
  releaseVersion: string,
  githubRequestConfig: GithubRequestConfig
) {
  const _axios = await import('axios');
  // axios types and values don't seem to match
  const axios = _axios as any as typeof _axios['default'];

  const typeGroups = groupBy(commits, 'type');

  const markdown: string[] = [];
  const breakingChanges = [];

  const commitTypes = {
    feat: { title: '🚀 Features' },
    perf: { title: '🔥 Performance' },
    fix: { title: '🩹 Fixes' },
    refactor: { title: '💅 Refactors' },
    docs: { title: '📖 Documentation' },
    build: { title: '📦 Build' },
    types: { title: '🌊 Types' },
    chore: { title: '🏡 Chore' },
    examples: { title: '🏀 Examples' },
    test: { title: '✅ Tests' },
    style: { title: '🎨 Styles' },
    ci: { title: '🤖 CI' },
  };

  // Version Title
  markdown.push('', `## ${releaseVersion}`, '');

  for (const type of Object.keys(commitTypes)) {
    const group = typeGroups[type];
    if (!group || group.length === 0) {
      continue;
    }

    markdown.push('', '### ' + commitTypes[type].title, '');
    for (const commit of group.reverse()) {
      const line = formatCommit(commit, githubRequestConfig);
      markdown.push(line);
      if (commit.isBreaking) {
        breakingChanges.push(line);
      }
    }
  }

  if (breakingChanges.length > 0) {
    markdown.push('', '#### ⚠️  Breaking Changes', '', ...breakingChanges);
  }

  const _authors = new Map<string, { email: Set<string>; github?: string }>();
  for (const commit of commits) {
    if (!commit.author) {
      continue;
    }
    const name = formatName(commit.author.name);
    if (!name || name.includes('[bot]')) {
      continue;
    }
    if (_authors.has(name)) {
      const entry = _authors.get(name);
      entry.email.add(commit.author.email);
    } else {
      _authors.set(name, { email: new Set([commit.author.email]) });
    }
  }

  // Try to map authors to github usernames
  await Promise.all(
    [..._authors.keys()].map(async (authorName) => {
      const meta = _authors.get(authorName);
      for (const email of meta.email) {
        // For these pseudo-anonymized emails we can just extract the Github username from before the @
        if (email.endsWith('@users.noreply.github.com')) {
          meta.github = email.split('@')[0];
          break;
        }
        // Look up any other emails against the ungh.cc API
        const { data } = await axios
          .get<any, { data?: { user?: { username: string } } }>(
            `https://ungh.cc/users/find/${email}`
          )
          .catch(() => ({ data: { user: null } }));
        if (data?.user) {
          meta.github = data.user.username;
          break;
        }
      }
    })
  );

  const authors = [..._authors.entries()].map((e) => ({ name: e[0], ...e[1] }));

  if (authors.length > 0) {
    markdown.push(
      '',
      '### ' + '❤️  Thank You',
      '',
      ...authors.map((i) => {
        const _email = [...i.email].find(
          (e) => !e.includes('noreply.github.com')
        );
        const email = _email ? `<${_email}>` : '';
        const github = i.github ? `@${i.github}` : '';
        return `- ${i.name} ${github || email}`;
      })
    );
  }

  return markdown.join('\n').trim();
}

async function syncGithubRelease(
  githubRequestConfig: GithubRequestConfig,
  release: { version: string; body: string },
  existingGithubReleaseForVersion?: GithubRelease
) {
  const ghRelease: GithubRelease = {
    tag_name: release.version,
    name: release.version,
    body: release.body,
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
  opts: {
    method?: 'GET' | 'POST' | 'PATCH';
    data?: GithubRelease;
    headers?: Record<string, string>;
  } = {}
) {
  const _axios = await import('axios');
  // axios types and values don't seem to match
  const axios = _axios as any as typeof _axios['default'];

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

function formatReference(
  ref: Reference,
  githubRequestConfig: GithubRequestConfig
) {
  const refSpec = providerToRefSpec['github'];
  return `[${ref.value}](https://github.com/${githubRequestConfig.repo}/${
    refSpec[ref.type]
  }/${ref.value.replace(/^#/, '')})`;
}

export function formatCommit(
  commit: GitCommit,
  githubRequestConfig: GithubRequestConfig
) {
  return (
    '- ' +
    (commit.scope ? `**${commit.scope.trim()}:** ` : '') +
    (commit.isBreaking ? '⚠️  ' : '') +
    commit.description +
    formatReferences(commit.references, githubRequestConfig)
  );
}

function formatReferences(
  references: Reference[],
  githubRequestConfig: GithubRequestConfig
) {
  const pr = references.filter((ref) => ref.type === 'pull-request');
  const issue = references.filter((ref) => ref.type === 'issue');
  if (pr.length > 0 || issue.length > 0) {
    return (
      ' (' +
      [...pr, ...issue]
        .map((ref) => formatReference(ref, githubRequestConfig))
        .join(', ') +
      ')'
    );
  }
  if (references.length > 0) {
    return ' (' + formatReference(references[0], githubRequestConfig) + ')';
  }
  return '';
}

function formatName(name = '') {
  return name
    .split(' ')
    .map((p) => p.trim())
    .join(' ');
}

function groupBy(items: any[], key: string) {
  const groups = {};
  for (const item of items) {
    groups[item[key]] = groups[item[key]] || [];
    groups[item[key]].push(item);
  }
  return groups;
}
