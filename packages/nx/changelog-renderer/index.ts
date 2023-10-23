import type { GitCommit } from '../src/command-line/release/utils/git';
import {
  RepoSlug,
  formatReferences,
} from '../src/command-line/release/utils/github';

// axios types and values don't seem to match
import _axios = require('axios');
const axios = _axios as any as typeof _axios['default'];

/**
 * The ChangelogRenderOptions are specific to each ChangelogRenderer implementation, and are taken
 * from the user's nx.json configuration and passed as is into the ChangelogRenderer function.
 */
export type ChangelogRenderOptions = Record<string, unknown>;

/**
 * A ChangelogRenderer function takes in the extracted commits and other relevant metadata
 * and returns a string, or a Promise of a string of changelog contents (usually markdown).
 *
 * @param {Object} config The configuration object for the ChangelogRenderer
 * @param {GitCommit[]} config.commits The collection of extracted commits to generate a changelog for
 * @param {string} config.releaseVersion The version that is being released
 * @param {string | null} config.project The name of specific project to generate a changelog for, or `null` if the overall workspace changelog
 * @param {string | false} config.entryWhenNoChanges The (already interpolated) string to use as the changelog entry when there are no changes, or `false` if no entry should be generated
 * @param {ChangelogRenderOptions} config.changelogRenderOptions The options specific to the ChangelogRenderer implementation
 */
export type ChangelogRenderer = (config: {
  commits: GitCommit[];
  releaseVersion: string;
  project: string | null;
  entryWhenNoChanges: string | false;
  changelogRenderOptions: DefaultChangelogRenderOptions;
  repoSlug?: RepoSlug;
}) => Promise<string> | string;

/**
 * The specific options available to the default implementation of the ChangelogRenderer that nx exports
 * for the common case.
 */
export interface DefaultChangelogRenderOptions extends ChangelogRenderOptions {
  /**
   * Whether or not the commit authors should be added to the bottom of the changelog in a "Thank You"
   * section. Defaults to true.
   */
  includeAuthors?: boolean;
}

/**
 * The default ChangelogRenderer implementation that nx exports for the common case of generating markdown
 * from the given commits and other metadata.
 */
const defaultChangelogRenderer: ChangelogRenderer = async ({
  commits,
  releaseVersion,
  project,
  entryWhenNoChanges,
  changelogRenderOptions,
  repoSlug,
}): Promise<string> => {
  const markdownLines: string[] = [];
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

  // workspace root level changelog
  if (project === null) {
    // No changes for the workspace
    if (commits.length === 0) {
      if (entryWhenNoChanges) {
        markdownLines.push(
          '',
          `## ${releaseVersion}\n\n${entryWhenNoChanges}`,
          ''
        );
      }
      return markdownLines.join('\n').trim();
    }

    const typeGroups = groupBy(commits, 'type');

    markdownLines.push('', `## ${releaseVersion}`, '');

    for (const type of Object.keys(commitTypes)) {
      const group = typeGroups[type];
      if (!group || group.length === 0) {
        continue;
      }

      markdownLines.push('', '### ' + commitTypes[type].title, '');

      /**
       * In order to make the final changelog most readable, we organize commits as follows:
       * - By scope, where scopes are in alphabetical order (commits with no scope are listed first)
       * - Within a particular scope grouping, we list commits in chronological order
       */
      const commitsInChronologicalOrder = group.reverse();
      const commitsGroupedByScope = groupBy(
        commitsInChronologicalOrder,
        'scope'
      );
      const scopesSortedAlphabetically = Object.keys(
        commitsGroupedByScope
      ).sort();

      for (const scope of scopesSortedAlphabetically) {
        const commits = commitsGroupedByScope[scope];
        for (const commit of commits) {
          const line = formatCommit(commit, repoSlug);
          markdownLines.push(line);
          if (commit.isBreaking) {
            breakingChanges.push(line);
          }
        }
      }
    }
  } else {
    // project level changelog
    const scopeGroups = groupBy(commits, 'scope');

    // Generating for a named project, but that project has no changes in the current set of commits, exit early
    if (!scopeGroups[project]) {
      if (entryWhenNoChanges) {
        markdownLines.push(
          '',
          `## ${releaseVersion}\n\n${entryWhenNoChanges}`,
          ''
        );
      }
      return markdownLines.join('\n').trim();
    }

    markdownLines.push('', `## ${releaseVersion}`, '');

    const typeGroups = groupBy(scopeGroups[project], 'type');
    for (const type of Object.keys(commitTypes)) {
      const group = typeGroups[type];
      if (!group || group.length === 0) {
        continue;
      }

      markdownLines.push('', `### ${commitTypes[type].title}`, '');

      const commitsInChronologicalOrder = group.reverse();
      for (const commit of commitsInChronologicalOrder) {
        const line = formatCommit(commit, repoSlug);
        markdownLines.push(line + '\n');
        if (commit.isBreaking) {
          breakingChanges.push(line);
        }
      }
    }
  }

  if (breakingChanges.length > 0) {
    markdownLines.push('', '#### ⚠️  Breaking Changes', '', ...breakingChanges);
  }

  if (changelogRenderOptions.includeAuthors) {
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
            // It could either be in the format: username@ or github_id+username@
            if (email.endsWith('@users.noreply.github.com')) {
              const match = email.match(
                /^(\d+\+)?([^@]+)@users\.noreply\.github\.com$/
              );
              if (match && match[2]) {
                meta.github = match[2];
                break;
              }
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

    const authors = [..._authors.entries()].map((e) => ({
      name: e[0],
      ...e[1],
    }));

    if (authors.length > 0) {
      markdownLines.push(
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
  }

  return markdownLines.join('\n').trim();
};

export default defaultChangelogRenderer;

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
