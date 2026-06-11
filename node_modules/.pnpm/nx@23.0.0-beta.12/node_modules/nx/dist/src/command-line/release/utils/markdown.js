"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseChangelogMarkdown = parseChangelogMarkdown;
function parseChangelogMarkdown(contents) {
    /**
     * The release header may include prerelease identifiers (e.g., -alpha.13),
     * and major releases may use a single #, instead of the standard ## used
     * for minor and patch releases. This regex matches all of these cases.
     */
    const CHANGELOG_RELEASE_HEAD_RE = new RegExp('^#+\\s*\\[?(\\d+\\.\\d+\\.\\d+(?:-[a-zA-Z0-9\\.]+)?)\\]?', 'gm');
    const headings = [...contents.matchAll(CHANGELOG_RELEASE_HEAD_RE)];
    const releases = [];
    for (let i = 0; i < headings.length; i++) {
        const heading = headings[i];
        const nextHeading = headings[i + 1];
        const version = heading[1];
        const release = {
            version: version,
            body: contents
                .slice(heading.index + heading[0].length, nextHeading ? nextHeading.index : contents.length)
                .trim(),
        };
        releases.push(release);
    }
    return {
        releases,
    };
}
