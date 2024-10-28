import { major } from 'semver';
import { ChangelogChange } from '../../src/command-line/release/changelog';
import { NxReleaseConfig } from '../../src/command-line/release/config/config';
import { DEFAULT_CONVENTIONAL_COMMITS_CONFIG } from '../../src/command-line/release/config/conventional-commits';
import {
  GithubRepoData,
  formatReferences,
} from '../../src/command-line/release/utils/github';

// axios types and values don't seem to match
import _axios = require('axios');
const axios = _axios as any as (typeof _axios)['default'];

/**
 * The ChangelogRenderOptions are specific to each ChangelogRenderer implementation, and are taken
 * from the user's nx.json configuration and passed as is into the ChangelogRenderer function.
 */
export type ChangelogRenderOptions = Record<string, unknown>;

/**
 * When versioning projects independently and enabling `"updateDependents": "auto"`, there could
 * be additional dependency bump information that is not captured in the commit data, but that nevertheless
 * should be included in the rendered changelog.
 */
export type DependencyBump = {
  dependencyName: string;
  newVersion: string;
};

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
   * If authors is enabled, controls whether or not to try to map the authors to their GitHub usernames
   * using https://ungh.cc (from https://github.com/unjs/ungh) and the email addresses found in the commits.
   * Defaults to true.
   */
  mapAuthorsToGitHubUsernames?: boolean;
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

export default class DefaultChangelogRenderer {
  protected changes: ChangelogChange[];
  protected changelogEntryVersion: string;
  protected project: string | null;
  protected entryWhenNoChanges: string | false;
  protected changelogRenderOptions: DefaultChangelogRenderOptions;
  protected isVersionPlans: boolean;
  protected dependencyBumps?: DependencyBump[];
  protected repoData?: GithubRepoData;
  protected conventionalCommitsConfig:
    | NxReleaseConfig['conventionalCommits']
    | null;
  protected relevantChanges: ChangelogChange[];
  protected breakingChanges: string[];
  protected additionalChangesForAuthorsSection: ChangelogChange[];

  /**
   * A ChangelogRenderer class takes in the determined changes and other relevant metadata
   * and returns a string, or a Promise of a string of changelog contents (usually markdown).
   *
   * @param {Object} config The configuration object for the ChangelogRenderer
   * @param {ChangelogChange[]} config.changes The collection of changes to show in the changelog
   * @param {string} config.changelogEntryVersion The version for which we are rendering the current changelog entry
   * @param {string | null} config.project The name of specific project to generate a changelog entry for, or `null` if the overall workspace changelog
   * @param {string | false} config.entryWhenNoChanges The (already interpolated) string to use as the changelog entry when there are no changes, or `false` if no entry should be generated
   * @param {boolean} config.isVersionPlans Whether or not Nx release version plans are the source of truth for the changelog entry
   * @param {ChangelogRenderOptions} config.changelogRenderOptions The options specific to the ChangelogRenderer implementation
   * @param {DependencyBump[]} config.dependencyBumps Optional list of additional dependency bumps that occurred as part of the release, outside of the change data
   * @param {GithubRepoData} config.repoData Resolved data for the current GitHub repository
   * @param {NxReleaseConfig['conventionalCommits'] | null} config.conventionalCommitsConfig The configuration for conventional commits, or null if version plans are being used
   */
  constructor(config: {
    changes: ChangelogChange[];
    changelogEntryVersion: string;
    project: string | null;
    entryWhenNoChanges: string | false;
    isVersionPlans: boolean;
    changelogRenderOptions: DefaultChangelogRenderOptions;
    dependencyBumps?: DependencyBump[];
    repoData?: GithubRepoData;
    conventionalCommitsConfig: NxReleaseConfig['conventionalCommits'] | null;
  }) {
    this.changes = this.filterChanges(config.changes, config.project);
    this.changelogEntryVersion = config.changelogEntryVersion;
    this.project = config.project;
    this.entryWhenNoChanges = config.entryWhenNoChanges;
    this.isVersionPlans = config.isVersionPlans;
    this.changelogRenderOptions = config.changelogRenderOptions;
    this.dependencyBumps = config.dependencyBumps;
    this.repoData = config.repoData;
    this.conventionalCommitsConfig = config.conventionalCommitsConfig;

    this.relevantChanges = [];
    this.breakingChanges = [];
    this.additionalChangesForAuthorsSection = [];
  }

  protected filterChanges(
    changes: ChangelogChange[],
    project: string | null
  ): ChangelogChange[] {
    if (project === null) {
      return changes;
    }
    return changes.filter(
      (c) =>
        c.affectedProjects &&
        (c.affectedProjects === '*' || c.affectedProjects.includes(project))
    );
  }

  async render(): Promise<string> {
    const sections: string[][] = [];

    this.preprocessChanges();

    if (this.shouldRenderEmptyEntry()) {
      return this.renderEmptyEntry();
    }

    sections.push([this.renderVersionTitle()]);

    const changesByType = this.renderChangesByType();
    if (changesByType.length > 0) {
      sections.push(changesByType);
    }

    if (this.hasBreakingChanges()) {
      sections.push(this.renderBreakingChanges());
    }

    if (this.hasDependencyBumps()) {
      sections.push(this.renderDependencyBumps());
    }

    if (this.shouldRenderAuthors()) {
      sections.push(await this.renderAuthors());
    }

    // Join sections with double newlines, and trim any extra whitespace
    return sections
      .filter((section) => section.length > 0)
      .map((section) => section.join('\n').trim())
      .join('\n\n')
      .trim();
  }

  protected preprocessChanges(): void {
    this.relevantChanges = [...this.changes];
    this.breakingChanges = [];
    this.additionalChangesForAuthorsSection = [];

    // Filter out reverted changes
    for (let i = this.relevantChanges.length - 1; i >= 0; i--) {
      const change = this.relevantChanges[i];
      if (change.type === 'revert' && change.revertedHashes) {
        for (const revertedHash of change.revertedHashes) {
          const revertedCommitIndex = this.relevantChanges.findIndex(
            (c) => c.shortHash && revertedHash.startsWith(c.shortHash)
          );
          if (revertedCommitIndex !== -1) {
            this.relevantChanges.splice(revertedCommitIndex, 1);
            this.relevantChanges.splice(i, 1);
            i--;
            break;
          }
        }
      }
    }

    if (this.isVersionPlans) {
      this.conventionalCommitsConfig = {
        types: {
          feat: DEFAULT_CONVENTIONAL_COMMITS_CONFIG.types.feat,
          fix: DEFAULT_CONVENTIONAL_COMMITS_CONFIG.types.fix,
        },
      };

      for (let i = this.relevantChanges.length - 1; i >= 0; i--) {
        if (this.relevantChanges[i].isBreaking) {
          const change = this.relevantChanges[i];
          this.additionalChangesForAuthorsSection.push(change);
          const line = this.formatChange(change);
          this.breakingChanges.push(line);
          this.relevantChanges.splice(i, 1);
        }
      }
    } else {
      for (const change of this.relevantChanges) {
        if (change.isBreaking) {
          const breakingChangeExplanation =
            this.extractBreakingChangeExplanation(change.body);
          this.breakingChanges.push(
            breakingChangeExplanation
              ? `- ${
                  change.scope ? `**${change.scope.trim()}:** ` : ''
                }${breakingChangeExplanation}`
              : this.formatChange(change)
          );
        }
      }
    }
  }

  protected shouldRenderEmptyEntry(): boolean {
    return (
      this.relevantChanges.length === 0 &&
      this.breakingChanges.length === 0 &&
      !this.hasDependencyBumps()
    );
  }

  protected renderEmptyEntry(): string {
    if (this.hasDependencyBumps()) {
      return [
        this.renderVersionTitle(),
        '',
        ...this.renderDependencyBumps(),
      ].join('\n');
    } else if (this.entryWhenNoChanges) {
      return `${this.renderVersionTitle()}\n\n${this.entryWhenNoChanges}`;
    }
    return '';
  }

  protected renderVersionTitle(): string {
    const isMajorVersion =
      `${major(this.changelogEntryVersion)}.0.0` ===
      this.changelogEntryVersion.replace(/^v/, '');
    let maybeDateStr = '';
    if (this.changelogRenderOptions.versionTitleDate) {
      const dateStr = new Date().toISOString().slice(0, 10);
      maybeDateStr = ` (${dateStr})`;
    }
    return isMajorVersion
      ? `# ${this.changelogEntryVersion}${maybeDateStr}`
      : `## ${this.changelogEntryVersion}${maybeDateStr}`;
  }

  protected renderChangesByType(): string[] {
    const markdownLines: string[] = [];
    const typeGroups = this.groupChangesByType();
    const changeTypes = this.conventionalCommitsConfig.types;

    for (const type of Object.keys(changeTypes)) {
      const group = typeGroups[type];
      if (!group || group.length === 0) {
        continue;
      }

      markdownLines.push('', `### ${changeTypes[type].changelog.title}`, '');

      if (this.project === null) {
        const changesGroupedByScope = this.groupChangesByScope(group);
        const scopesSortedAlphabetically = Object.keys(
          changesGroupedByScope
        ).sort();

        for (const scope of scopesSortedAlphabetically) {
          const changes = changesGroupedByScope[scope];
          for (const change of changes.reverse()) {
            const line = this.formatChange(change);
            markdownLines.push(line);
            if (change.isBreaking && !this.isVersionPlans) {
              const breakingChangeExplanation =
                this.extractBreakingChangeExplanation(change.body);
              this.breakingChanges.push(
                breakingChangeExplanation
                  ? `- ${
                      change.scope ? `**${change.scope.trim()}:** ` : ''
                    }${breakingChangeExplanation}`
                  : line
              );
            }
          }
        }
      } else {
        // For project-specific changelogs, maintain the original order
        for (const change of group) {
          const line = this.formatChange(change);
          markdownLines.push(line);
          if (change.isBreaking && !this.isVersionPlans) {
            const breakingChangeExplanation =
              this.extractBreakingChangeExplanation(change.body);
            this.breakingChanges.push(
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

    return markdownLines;
  }

  protected hasBreakingChanges(): boolean {
    return this.breakingChanges.length > 0;
  }

  protected renderBreakingChanges(): string[] {
    const uniqueBreakingChanges = Array.from(new Set(this.breakingChanges));
    return ['### ⚠️  Breaking Changes', '', ...uniqueBreakingChanges];
  }

  protected hasDependencyBumps(): boolean {
    return this.dependencyBumps && this.dependencyBumps.length > 0;
  }

  protected renderDependencyBumps(): string[] {
    const markdownLines = ['', '### 🧱 Updated Dependencies', ''];
    this.dependencyBumps.forEach(({ dependencyName, newVersion }) => {
      markdownLines.push(`- Updated ${dependencyName} to ${newVersion}`);
    });
    return markdownLines;
  }

  protected shouldRenderAuthors(): boolean {
    return this.changelogRenderOptions.authors;
  }

  protected async renderAuthors(): Promise<string[]> {
    const markdownLines: string[] = [];
    const _authors = new Map<string, { email: Set<string>; github?: string }>();

    for (const change of [
      ...this.relevantChanges,
      ...this.additionalChangesForAuthorsSection,
    ]) {
      if (!change.authors) {
        continue;
      }
      for (const author of change.authors) {
        const name = this.formatName(author.name);
        if (!name || name.includes('[bot]')) {
          continue;
        }
        if (_authors.has(name)) {
          const entry = _authors.get(name);
          entry.email.add(author.email);
        } else {
          _authors.set(name, { email: new Set([author.email]) });
        }
      }
    }

    if (
      this.repoData &&
      this.changelogRenderOptions.mapAuthorsToGitHubUsernames
    ) {
      await Promise.all(
        [..._authors.keys()].map(async (authorName) => {
          const meta = _authors.get(authorName);
          for (const email of meta.email) {
            if (email.endsWith('@users.noreply.github.com')) {
              const match = email.match(
                /^(\d+\+)?([^@]+)@users\.noreply\.github\.com$/
              );
              if (match && match[2]) {
                meta.github = match[2];
                break;
              }
            }
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
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((i) => {
            const github = i.github ? ` @${i.github}` : '';
            return `- ${i.name}${github}`;
          })
      );
    }

    return markdownLines;
  }

  protected formatChange(change: ChangelogChange): string {
    let description = change.description;
    let extraLines = [];
    let extraLinesStr = '';
    if (description.includes('\n')) {
      [description, ...extraLines] = description.split('\n');
      const indentation = '  ';
      extraLinesStr = extraLines
        .filter((l) => l.trim().length > 0)
        .map((l) => `${indentation}${l}`)
        .join('\n');
    }

    let changeLine =
      '- ' +
      (!this.isVersionPlans && change.isBreaking ? '⚠️  ' : '') +
      (!this.isVersionPlans && change.scope
        ? `**${change.scope.trim()}:** `
        : '') +
      description;
    if (this.repoData && this.changelogRenderOptions.commitReferences) {
      changeLine += formatReferences(change.githubReferences, this.repoData);
    }
    if (extraLinesStr) {
      changeLine += '\n\n' + extraLinesStr;
    }
    return changeLine;
  }

  protected groupChangesByType(): Record<string, ChangelogChange[]> {
    const typeGroups: Record<string, ChangelogChange[]> = {};
    for (const change of this.relevantChanges) {
      typeGroups[change.type] = typeGroups[change.type] || [];
      typeGroups[change.type].push(change);
    }
    return typeGroups;
  }

  protected groupChangesByScope(
    changes: ChangelogChange[]
  ): Record<string, ChangelogChange[]> {
    const scopeGroups: Record<string, ChangelogChange[]> = {};
    for (const change of changes) {
      const scope = change.scope || '';
      scopeGroups[scope] = scopeGroups[scope] || [];
      scopeGroups[scope].push(change);
    }
    return scopeGroups;
  }

  protected extractBreakingChangeExplanation(message: string): string | null {
    if (!message) {
      return null;
    }

    const breakingChangeIdentifier = 'BREAKING CHANGE:';
    const startIndex = message.indexOf(breakingChangeIdentifier);

    if (startIndex === -1) {
      return null;
    }

    const startOfBreakingChange = startIndex + breakingChangeIdentifier.length;
    const endOfBreakingChange = message.indexOf('\n', startOfBreakingChange);

    if (endOfBreakingChange === -1) {
      return message.substring(startOfBreakingChange).trim();
    }

    return message.substring(startOfBreakingChange, endOfBreakingChange).trim();
  }

  protected formatName(name = ''): string {
    return name
      .split(' ')
      .map((p) => p.trim())
      .join(' ');
  }
}
