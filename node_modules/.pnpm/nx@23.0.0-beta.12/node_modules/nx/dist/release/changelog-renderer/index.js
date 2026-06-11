"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const semver_1 = require("semver");
class DefaultChangelogRenderer {
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
    constructor(config) {
        this.changes = this.filterChanges(config.changes, config.project);
        this.changelogEntryVersion = config.changelogEntryVersion;
        this.project = config.project;
        this.entryWhenNoChanges = config.entryWhenNoChanges;
        this.isVersionPlans = config.isVersionPlans;
        this.changelogRenderOptions = config.changelogRenderOptions;
        this.dependencyBumps = config.dependencyBumps;
        this.conventionalCommitsConfig = config.conventionalCommitsConfig;
        this.remoteReleaseClient = config.remoteReleaseClient;
        this.relevantChanges = [];
        this.breakingChanges = [];
        this.additionalChangesForAuthorsSection = [];
    }
    filterChanges(changes, project) {
        if (project === null) {
            return changes;
        }
        return changes.filter((c) => c.affectedProjects &&
            (c.affectedProjects === '*' || c.affectedProjects.includes(project)));
    }
    async render() {
        const sections = [];
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
    preprocessChanges() {
        this.relevantChanges = [...this.changes];
        this.breakingChanges = [];
        this.additionalChangesForAuthorsSection = [];
        // Filter out reverted changes
        for (let i = this.relevantChanges.length - 1; i >= 0; i--) {
            const change = this.relevantChanges[i];
            if (change.type === 'revert' && change.revertedHashes) {
                for (const revertedHash of change.revertedHashes) {
                    const revertedCommitIndex = this.relevantChanges.findIndex((c) => c.shortHash && revertedHash.startsWith(c.shortHash));
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
            for (let i = this.relevantChanges.length - 1; i >= 0; i--) {
                if (this.relevantChanges[i].isBreaking) {
                    const change = this.relevantChanges[i];
                    this.additionalChangesForAuthorsSection.push(change);
                    const line = this.formatChange(change);
                    this.breakingChanges.push(line);
                    this.relevantChanges.splice(i, 1);
                }
            }
        }
        else {
            for (const change of this.relevantChanges) {
                if (change.isBreaking) {
                    this.breakingChanges.push(this.formatBreakingChange(change));
                }
            }
        }
    }
    shouldRenderEmptyEntry() {
        return (this.relevantChanges.length === 0 &&
            this.breakingChanges.length === 0 &&
            !this.hasDependencyBumps());
    }
    renderEmptyEntry() {
        if (this.hasDependencyBumps()) {
            return [
                this.renderVersionTitle(),
                '',
                ...this.renderDependencyBumps(),
            ].join('\n');
        }
        else if (this.entryWhenNoChanges) {
            return `${this.renderVersionTitle()}\n\n${this.entryWhenNoChanges}`;
        }
        return '';
    }
    renderVersionTitle() {
        let isMajorVersion = true;
        try {
            isMajorVersion =
                `${(0, semver_1.major)(this.changelogEntryVersion)}.0.0` ===
                    this.changelogEntryVersion.replace(/^v/, '');
        }
        catch {
            // Do nothing with the error
            // Prevent non-semver versions from erroring out
        }
        let maybeDateStr = '';
        if (this.changelogRenderOptions.versionTitleDate) {
            const dateStr = new Date().toISOString().slice(0, 10);
            maybeDateStr = ` (${dateStr})`;
        }
        return isMajorVersion
            ? `# ${this.changelogEntryVersion}${maybeDateStr}`
            : `## ${this.changelogEntryVersion}${maybeDateStr}`;
    }
    renderChangesByType() {
        const markdownLines = [];
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
                const scopesSortedAlphabetically = Object.keys(changesGroupedByScope).sort();
                for (const scope of scopesSortedAlphabetically) {
                    const changes = changesGroupedByScope[scope];
                    for (const change of changes.reverse()) {
                        const line = this.formatChange(change);
                        markdownLines.push(line);
                        if (change.isBreaking && !this.isVersionPlans) {
                            this.breakingChanges.push(this.formatBreakingChange(change));
                        }
                    }
                }
            }
            else {
                // For project-specific changelogs, maintain the original order
                for (const change of group) {
                    const line = this.formatChange(change);
                    markdownLines.push(line);
                    if (change.isBreaking && !this.isVersionPlans) {
                        this.breakingChanges.push(this.formatBreakingChange(change));
                    }
                }
            }
        }
        return markdownLines;
    }
    hasBreakingChanges() {
        return this.breakingChanges.length > 0;
    }
    renderBreakingChanges() {
        const uniqueBreakingChanges = Array.from(new Set(this.breakingChanges));
        return ['### ⚠️  Breaking Changes', '', ...uniqueBreakingChanges];
    }
    hasDependencyBumps() {
        return this.dependencyBumps && this.dependencyBumps.length > 0;
    }
    renderDependencyBumps() {
        const markdownLines = ['', '### 🧱 Updated Dependencies', ''];
        this.dependencyBumps.forEach(({ dependencyName, newVersion }) => {
            markdownLines.push(`- Updated ${dependencyName} to ${newVersion}`);
        });
        return markdownLines;
    }
    shouldRenderAuthors() {
        return this.changelogRenderOptions.authors;
    }
    async renderAuthors() {
        const markdownLines = [];
        const _authors = new Map();
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
                }
                else {
                    _authors.set(name, { email: new Set([author.email]) });
                }
            }
        }
        if (this.remoteReleaseClient.getRemoteRepoData() &&
            this.changelogRenderOptions.applyUsernameToAuthors &&
            // TODO: Explore if it is possible to support GitLab username resolution
            this.remoteReleaseClient.remoteReleaseProviderName === 'GitHub') {
            await this.remoteReleaseClient.applyUsernameToAuthors(_authors);
        }
        const authors = [..._authors.entries()].map((e) => ({
            name: e[0],
            ...e[1],
        }));
        if (authors.length > 0) {
            markdownLines.push('', '### ' + '❤️ Thank You', '', ...authors
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((i) => {
                const username = i.username ? ` @${i.username}` : '';
                return `- ${i.name}${username}`;
            }));
        }
        return markdownLines;
    }
    formatChange(change) {
        let description = change.description;
        let extraLines = [];
        let extraLinesStr = '';
        if (description.includes('\n')) {
            [description, ...extraLines] = description.split('\n');
            const indentation = '  ';
            extraLinesStr = (this.isVersionPlans
                ? // Preserve newlines for version plan sources to allow author to maintain maximum control over final contents
                    extraLines
                : extraLines.filter((l) => l.trim().length > 0))
                // Only add indentation to lines with content
                .map((l) => (l.trim().length > 0 ? `${indentation}${l}` : ''))
                .join('\n');
        }
        let changeLine = '- ' +
            (!this.isVersionPlans && change.isBreaking ? '⚠️  ' : '') +
            (!this.isVersionPlans && change.scope
                ? `**${change.scope.trim()}:** `
                : '') +
            description;
        if (this.remoteReleaseClient.getRemoteRepoData() &&
            this.changelogRenderOptions.commitReferences &&
            change.githubReferences) {
            changeLine += this.remoteReleaseClient.formatReferences(change.githubReferences);
        }
        if (extraLinesStr) {
            changeLine += (this.isVersionPlans ? '\n' : '\n\n') + extraLinesStr;
        }
        return changeLine;
    }
    formatBreakingChangeBase(change) {
        let breakingLine = '- ';
        if (change.scope) {
            breakingLine += `**${change.scope.trim()}:** `;
        }
        if (change.description) {
            breakingLine += `${change.description.trim()}`;
        }
        if (this.remoteReleaseClient.getRemoteRepoData() &&
            this.changelogRenderOptions.commitReferences &&
            change.githubReferences) {
            breakingLine += ` ${this.remoteReleaseClient.formatReferences(change.githubReferences)}`;
        }
        return breakingLine;
    }
    formatBreakingChange(change) {
        const explanation = this.extractBreakingChangeExplanation(change.body);
        const baseLine = this.formatBreakingChangeBase(change);
        if (!explanation) {
            return baseLine;
        }
        const indentation = '  ';
        let breakingLine = baseLine + `\n${indentation}`;
        // Handle multi-line explanations
        let explanationText = explanation;
        let extraLines = [];
        if (explanation.includes('\n')) {
            [explanationText, ...extraLines] = explanation.split('\n');
        }
        breakingLine += explanationText;
        // Add extra lines with indentation (matching formatChange behavior)
        if (extraLines.length > 0) {
            const extraLinesStr = extraLines
                .filter((l) => l.trim().length > 0)
                .map((l) => `${indentation}${l}`)
                .join('\n');
            if (extraLinesStr) {
                breakingLine += '\n' + extraLinesStr;
            }
        }
        return breakingLine;
    }
    groupChangesByType() {
        const typeGroups = {};
        for (const change of this.relevantChanges) {
            typeGroups[change.type] = typeGroups[change.type] || [];
            typeGroups[change.type].push(change);
        }
        return typeGroups;
    }
    groupChangesByScope(changes) {
        const scopeGroups = {};
        for (const change of changes) {
            const scope = change.scope || '';
            scopeGroups[scope] = scopeGroups[scope] || [];
            scopeGroups[scope].push(change);
        }
        return scopeGroups;
    }
    extractBreakingChangeExplanation(message) {
        if (!message) {
            return null;
        }
        const breakingChangeIdentifier = 'BREAKING CHANGE:';
        const startIndex = message.indexOf(breakingChangeIdentifier);
        if (startIndex === -1) {
            return null;
        }
        const startOfBreakingChange = startIndex + breakingChangeIdentifier.length;
        // Extract all text after BREAKING CHANGE: until we hit a Co-authored-by section or git metadata
        let endOfBreakingChange = message.length;
        const coAuthoredBySection = message.indexOf('---------\n\nCo-authored-by:');
        if (coAuthoredBySection !== -1) {
            endOfBreakingChange = coAuthoredBySection;
        }
        else {
            // Look for the git metadata delimiter (a line with just ")
            const gitMetadataMarker = message.indexOf('"\n', startOfBreakingChange);
            if (gitMetadataMarker !== -1) {
                endOfBreakingChange = gitMetadataMarker;
            }
        }
        return message.substring(startOfBreakingChange, endOfBreakingChange).trim();
    }
    formatName(name = '') {
        return name
            .split(' ')
            .map((p) => p.trim())
            .join(' ');
    }
}
exports.default = DefaultChangelogRenderer;
