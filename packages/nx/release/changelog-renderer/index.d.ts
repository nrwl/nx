import type { ChangelogChange } from '../../src/command-line/release/changelog';
import type { NxReleaseConfig } from '../../src/command-line/release/config/config';
import type { RemoteReleaseClient } from '../../src/command-line/release/utils/remote-release-clients/remote-release-client';
/**
 * Re-export for ease of use in custom changelog renderers.
 */
export type { ChangelogChange };
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
    applyUsernameToAuthors?: boolean;
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
    protected conventionalCommitsConfig: NxReleaseConfig['conventionalCommits'];
    protected relevantChanges: ChangelogChange[];
    protected breakingChanges: string[];
    protected additionalChangesForAuthorsSection: ChangelogChange[];
    protected remoteReleaseClient: RemoteReleaseClient<unknown>;
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
     * @param {NxReleaseConfig['conventionalCommits']} config.conventionalCommitsConfig The configuration for conventional commits
     * @param {RemoteReleaseClient} config.remoteReleaseClient The remote release client to use for formatting references
     */
    constructor(config: {
        changes: ChangelogChange[];
        changelogEntryVersion: string;
        project: string | null;
        entryWhenNoChanges: string | false;
        isVersionPlans: boolean;
        changelogRenderOptions: DefaultChangelogRenderOptions;
        dependencyBumps?: DependencyBump[];
        conventionalCommitsConfig: NxReleaseConfig['conventionalCommits'];
        remoteReleaseClient: RemoteReleaseClient<unknown>;
    });
    protected filterChanges(changes: ChangelogChange[], project: string | null): ChangelogChange[];
    render(): Promise<string>;
    protected preprocessChanges(): void;
    protected shouldRenderEmptyEntry(): boolean;
    protected renderEmptyEntry(): string;
    protected renderVersionTitle(): string;
    protected renderChangesByType(): string[];
    protected hasBreakingChanges(): boolean;
    protected renderBreakingChanges(): string[];
    protected hasDependencyBumps(): boolean;
    protected renderDependencyBumps(): string[];
    protected shouldRenderAuthors(): boolean;
    protected renderAuthors(): Promise<string[]>;
    protected formatChange(change: ChangelogChange): string;
    protected formatBreakingChange(change: ChangelogChange): string;
    protected groupChangesByType(): Record<string, ChangelogChange[]>;
    protected groupChangesByScope(changes: ChangelogChange[]): Record<string, ChangelogChange[]>;
    protected extractBreakingChangeExplanation(message: string): string | null;
    protected formatName(name?: string): string;
}
//# sourceMappingURL=index.d.ts.map