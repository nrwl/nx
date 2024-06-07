import { major } from 'semver';
import { ChangelogChange } from '../../src/command-line/release/changelog';
import { NxReleaseConfig } from '../../src/command-line/release/config/config';
import { GitCommit } from '../../src/command-line/release/utils/git';
import {
  RepoSlug,
  formatReferences,
} from '../../src/command-line/release/utils/github';
import type { ProjectGraph } from '../../src/config/project-graph';

// axios types and values don't seem to match
import _axios = require('axios');
const axios = _axios as any as (typeof _axios)['default'];

/**
 * The ChangelogRenderOptions are specific to each ChangelogRenderer implementation, and are taken
 * from the user's nx.json configuration and passed as is into the ChangelogRenderer function.
 */
export type ChangelogRenderOptions = Record<string, unknown>;

/**
 * When versioning projects independently and enabling `"updateDependents": "always"`, there could
 * be additional dependency bump information that is not captured in the commit data, but that nevertheless
 * should be included in the rendered changelog.
 */
export type DependencyBump = {
  dependencyName: string;
  newVersion: string;
};

/**
 * A ChangelogRenderer function takes in the extracted commits and other relevant metadata
 * and returns a string, or a Promise of a string of changelog contents (usually markdown).
 *
 * @param {Object} config The configuration object for the ChangelogRenderer
 * @param {ProjectGraph} config.projectGraph The project graph for the workspace
 * @param {GitCommit[]} config.commits DEPRECATED [Use 'config.changes' instead] - The collection of extracted commits to generate a changelog for
 * @param {ChangelogChange[]} config.changes The collection of changes to show in the changelog
 * @param {string} config.releaseVersion The version that is being released
 * @param {string | null} config.project The name of specific project to generate a changelog for, or `null` if the overall workspace changelog
 * @param {string | false} config.entryWhenNoChanges The (already interpolated) string to use as the changelog entry when there are no changes, or `false` if no entry should be generated
 * @param {ChangelogRenderOptions} config.changelogRenderOptions The options specific to the ChangelogRenderer implementation
 * @param {DependencyBump[]} config.dependencyBumps Optional list of additional dependency bumps that occurred as part of the release, outside of the commit data
 */
export type ChangelogRenderer = (config: {
  projectGraph: ProjectGraph;
  // TODO: remove 'commits' and make 'changes' whenever we make the next breaking change to this API
  commits?: GitCommit[];
  changes?: ChangelogChange[];
  releaseVersion: string;
  project: string | null;
  entryWhenNoChanges: string | false;
  changelogRenderOptions: DefaultChangelogRenderOptions;
  dependencyBumps?: DependencyBump[];
  repoSlug?: RepoSlug;
  conventionalCommitsConfig: NxReleaseConfig['conventionalCommits'];
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
  authors?: boolean;
  /**
   * Whether or not the commit references (such as commit and/or PR links) should be included in the changelog.
   * Defaults to true.
   */
  commitReferences?: boolean;
  /**
   * Whether or not to include the date in the version title. It can be set to false to disable it, or true to enable
   * with the default of (YYYY-MM-DD). Defaults to true.
   */
  versionTitleDate?: boolean;
}

/**
 * The default ChangelogRenderer implementation that nx exports for the common case of generating markdown
 * from the given commits and other metadata.
 */
const defaultChangelogRenderer: ChangelogRenderer = async ({
  projectGraph,
  changes,
  releaseVersion,
  project,
  entryWhenNoChanges,
  changelogRenderOptions,
  dependencyBumps,
  repoSlug,
  conventionalCommitsConfig,
}): Promise<string> => {
  const changeTypes = conventionalCommitsConfig.types;
  const markdownLines: string[] = [];
  const breakingChanges = [];

  // If the current range of changes contains both a commit and its revert, we strip them both from the final list. Changes from version plans are unaffected, as they have no hashes.
  for (const change of changes) {
    if (change.type === 'revert' && change.revertedHashes) {
      for (const revertedHash of change.revertedHashes) {
        const revertedCommit = changes.find(
          (c) => c.shortHash && revertedHash.startsWith(c.shortHash)
        );
        if (revertedCommit) {
          changes.splice(changes.indexOf(revertedCommit), 1);
          changes.splice(changes.indexOf(change), 1);
        }
      }
    }
  }

  // workspace root level changelog
  if (project === null) {
    // No changes for the workspace
    if (changes.length === 0) {
      if (dependencyBumps?.length) {
        applyAdditionalDependencyBumps({
          markdownLines,
          dependencyBumps,
          releaseVersion,
          changelogRenderOptions,
        });
      } else if (entryWhenNoChanges) {
        markdownLines.push(
          '',
          `${createVersionTitle(
            releaseVersion,
            changelogRenderOptions
          )}\n\n${entryWhenNoChanges}`,
          ''
        );
      }
      return markdownLines.join('\n').trim();
    }

    const typeGroups: Record<string, ChangelogChange[]> = groupBy(
      changes,
      'type'
    );

    markdownLines.push(
      '',
      createVersionTitle(releaseVersion, changelogRenderOptions),
      ''
    );

    for (const type of Object.keys(changeTypes)) {
      const group = typeGroups[type];
      if (!group || group.length === 0) {
        continue;
      }

      markdownLines.push('', '### ' + changeTypes[type].changelog.title, '');

      /**
       * In order to make the final changelog most readable, we organize changes as follows:
       * - By scope, where scopes are in alphabetical order (changes with no scope are listed first)
       * - Within a particular scope grouping, we list changes in chronological order
       */
      const changesInChronologicalOrder = group.reverse();
      const changesGroupedByScope: Record<string, ChangelogChange[]> = groupBy(
        changesInChronologicalOrder,
        'scope'
      );
      const scopesSortedAlphabetically = Object.keys(
        changesGroupedByScope
      ).sort();

      for (const scope of scopesSortedAlphabetically) {
        const changes = changesGroupedByScope[scope];
        for (const change of changes) {
          const line = formatChange(change, changelogRenderOptions, repoSlug);
          markdownLines.push(line);
          if (change.isBreaking) {
            const breakingChangeExplanation = extractBreakingChangeExplanation(
              change.body
            );
            breakingChanges.push(
              breakingChangeExplanation
                ? `- ${
                    change.scope ? `**${change.scope.trim()}:** ` : ''
                  }${breakingChangeExplanation}`
                : line
            );
          }
        }
      }
    }
  } else {
    // project level changelog
    const relevantChanges = changes.filter(
      (c) =>
        c.affectedProjects &&
        (c.affectedProjects === '*' || c.affectedProjects.includes(project))
    );

    // Generating for a named project, but that project has no relevant changes in the current set of commits, exit early
    if (relevantChanges.length === 0) {
      if (dependencyBumps?.length) {
        applyAdditionalDependencyBumps({
          markdownLines,
          dependencyBumps,
          releaseVersion,
          changelogRenderOptions,
        });
      } else if (entryWhenNoChanges) {
        markdownLines.push(
          '',
          `${createVersionTitle(
            releaseVersion,
            changelogRenderOptions
          )}\n\n${entryWhenNoChanges}`,
          ''
        );
      }
      return markdownLines.join('\n').trim();
    }

    markdownLines.push(
      '',
      createVersionTitle(releaseVersion, changelogRenderOptions),
      ''
    );

    const typeGroups: Record<string, ChangelogChange[]> = groupBy(
      // Sort the relevant changes to have the unscoped changes first, before grouping by type
      relevantChanges.sort((a, b) => (b.scope ? 1 : 0) - (a.scope ? 1 : 0)),
      'type'
    );
    for (const type of Object.keys(changeTypes)) {
      const group = typeGroups[type];
      if (!group || group.length === 0) {
        continue;
      }

      markdownLines.push('', `### ${changeTypes[type].changelog.title}`, '');

      const changesInChronologicalOrder = group.reverse();
      for (const change of changesInChronologicalOrder) {
        const line = formatChange(change, changelogRenderOptions, repoSlug);
        markdownLines.push(line + '\n');
        if (change.isBreaking) {
          const breakingChangeExplanation = extractBreakingChangeExplanation(
            change.body
          );
          breakingChanges.push(
            breakingChangeExplanation
              ? `- ${
                  change.scope ? `**${change.scope.trim()}:** ` : ''
                }${breakingChangeExplanation}`
              : line
          );
        }
      }
    }
  }

  if (breakingChanges.length > 0) {
    markdownLines.push('', '#### ⚠️  Breaking Changes', '', ...breakingChanges);
  }

  if (dependencyBumps?.length) {
    applyAdditionalDependencyBumps({
      markdownLines,
      dependencyBumps,
      releaseVersion,
      changelogRenderOptions,
    });
  }

  if (changelogRenderOptions.authors) {
    const _authors = new Map<string, { email: Set<string>; github?: string }>();
    for (const change of changes) {
      if (!change.author) {
        continue;
      }
      const name = formatName(change.author.name);
      if (!name || name.includes('[bot]')) {
        continue;
      }
      if (_authors.has(name)) {
        const entry = _authors.get(name);
        entry.email.add(change.author.email);
      } else {
        _authors.set(name, { email: new Set([change.author.email]) });
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

function applyAdditionalDependencyBumps({
  markdownLines,
  dependencyBumps,
  releaseVersion,
  changelogRenderOptions,
}: {
  markdownLines: string[];
  dependencyBumps: DependencyBump[];
  releaseVersion: string;
  changelogRenderOptions: DefaultChangelogRenderOptions;
}) {
  if (markdownLines.length === 0) {
    markdownLines.push(
      '',
      `${createVersionTitle(releaseVersion, changelogRenderOptions)}\n`,
      ''
    );
  } else {
    markdownLines.push('');
  }
  markdownLines.push('### 🧱 Updated Dependencies\n');
  dependencyBumps.forEach(({ dependencyName, newVersion }) => {
    markdownLines.push(`- Updated ${dependencyName} to ${newVersion}`);
  });
  markdownLines.push('');
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

function formatChange(
  change: ChangelogChange,
  changelogRenderOptions: DefaultChangelogRenderOptions,
  repoSlug?: RepoSlug
): string {
  let changeLine =
    '- ' +
    (change.isBreaking ? '⚠️  ' : '') +
    (change.scope ? `**${change.scope.trim()}:** ` : '') +
    change.description;
  if (repoSlug && changelogRenderOptions.commitReferences) {
    changeLine += formatReferences(change.githubReferences, repoSlug);
  }
  return changeLine;
}

/**
 * It is common to add further information about a breaking change in the commit body,
 * and it is naturally that information that should be included in the BREAKING CHANGES
 * section of changelog, rather than repeating the commit title/description.
 */
function extractBreakingChangeExplanation(message: string): string | null {
  if (!message) {
    return null;
  }

  const breakingChangeIdentifier = 'BREAKING CHANGE:';
  const startIndex = message.indexOf(breakingChangeIdentifier);

  if (startIndex === -1) {
    // "BREAKING CHANGE:" not found in the message
    return null;
  }

  const startOfBreakingChange = startIndex + breakingChangeIdentifier.length;
  const endOfBreakingChange = message.indexOf('\n', startOfBreakingChange);

  if (endOfBreakingChange === -1) {
    // No newline character found, extract till the end of the message
    return message.substring(startOfBreakingChange).trim();
  }

  // Extract and return the breaking change message
  return message.substring(startOfBreakingChange, endOfBreakingChange).trim();
}

function createVersionTitle(
  version: string,
  changelogRenderOptions: DefaultChangelogRenderOptions
) {
  // Normalize by removing any leading `v` during comparison
  const isMajorVersion = `${major(version)}.0.0` === version.replace(/^v/, '');
  let maybeDateStr = '';
  if (changelogRenderOptions.versionTitleDate) {
    // YYYY-MM-DD
    const dateStr = new Date().toISOString().slice(0, 10);
    maybeDateStr = ` (${dateStr})`;
  }
  if (isMajorVersion) {
    return `# ${version}${maybeDateStr}`;
  }
  return `## ${version}${maybeDateStr}`;
}
