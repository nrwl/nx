import { GitCommit } from './git';
import { RepoSlug, formatReferences } from './github';

// axios types and values don't seem to match
import _axios = require('axios');
const axios = _axios as any as typeof _axios['default'];

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

function formatCommit(commit: GitCommit, repoSlug?: RepoSlug): string {
  let commitLine =
    '- ' +
    (commit.scope ? `**${commit.scope.trim()}:** ` : '') +
    (commit.isBreaking ? '⚠️  ' : '') +
    commit.description;
  if (repoSlug) {
    commitLine += formatReferences(commit.references, repoSlug);
  }
  return commitLine;
}

// TODO: allow this to be configurable via config in a future release
export async function generateMarkdown(
  commits: GitCommit[],
  releaseVersion: string,
  repoSlug?: RepoSlug
) {
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

    /**
     * In order to make the final changelog most readable, we organize commits as follows:
     * - By scope, where scopes are in alphabetical order (commits with no scope are listed first)
     * - Within a particular scope grouping, we list commits in chronological order
     */
    const commitsInChronologicalOrder = group.reverse();
    const commitsGroupedByScope = groupBy(commitsInChronologicalOrder, 'scope');
    const scopesSortedAlphabetically = Object.keys(
      commitsGroupedByScope
    ).sort();

    for (const scope of scopesSortedAlphabetically) {
      const commits = commitsGroupedByScope[scope];
      for (const commit of commits) {
        const line = formatCommit(commit, repoSlug);
        markdown.push(line);
        if (commit.isBreaking) {
          breakingChanges.push(line);
        }
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
  if (repoSlug) {
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
  }

  const authors = [..._authors.entries()].map((e) => ({ name: e[0], ...e[1] }));

  if (authors.length > 0) {
    markdown.push(
      '',
      '### ' + '❤️  Thank You',
      '',
      ...authors
        // Sort the contributors by name
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((i) => {
          // Tag the author's Github username if we were able to resolve it so that Github adds them as a contributor
          const github = i.github ? ` @${i.github}` : '';
          return `- ${i.name}${github}`;
        })
    );
  }

  return markdown.join('\n').trim();
}

function escapeRegExp(string: string) {
  return string.replace(/[.*+\-?^${}()|[\]\\]/g, '\\$&');
}

export function parseChangelogMarkdown(
  contents: string,
  tagVersionPrefix: any
) {
  const escapedTagVersionPrefix = escapeRegExp(tagVersionPrefix);

  const CHANGELOG_RELEASE_HEAD_RE = new RegExp(
    '^#{2,}\\s+' + escapedTagVersionPrefix + '(\\d+\\.\\d+\\.\\d+)',
    'gm'
  );

  const headings = [...contents.matchAll(CHANGELOG_RELEASE_HEAD_RE)];
  const releases: { version?: string; body: string }[] = [];

  for (let i = 0; i < headings.length; i++) {
    const heading = headings[i];
    const nextHeading = headings[i + 1];
    const version = heading[1];

    const release = {
      version: version,
      body: contents
        .slice(
          heading.index + heading[0].length,
          nextHeading ? nextHeading.index : contents.length
        )
        .trim(),
    };
    releases.push(release);
  }

  return {
    releases,
  };
}
