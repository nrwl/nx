"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractGitHubRepoSlug = extractGitHubRepoSlug;
exports.extractGitLabRepoSlug = extractGitLabRepoSlug;
/**
 * Extracts a GitHub-style repo slug (user/repo).
 */
function extractGitHubRepoSlug(remoteUrl, expectedHostname) {
    return extractRepoSlug(remoteUrl, expectedHostname, 2);
}
/**
 * Extracts a GitLab-style repo slug with full nested group path.
 */
function extractGitLabRepoSlug(remoteUrl, expectedHostname) {
    return extractRepoSlug(remoteUrl, expectedHostname, Infinity);
}
const SCP_URL_REGEX = /^git@([^:]+):(.+)$/;
/**
 * Extracts a repository slug from a Git remote URL.
 * `segmentLimit` = 2 for GitHub (user/repo), `Infinity` for GitLab (with subgroups).
 */
function extractRepoSlug(remoteUrl, expectedHostname, segmentLimit) {
    if (!remoteUrl)
        return null;
    // SCP-like: git@host:path
    const scpMatch = remoteUrl.match(SCP_URL_REGEX);
    if (scpMatch) {
        const [, host, path] = scpMatch;
        if (!isHostMatch(host, expectedHostname))
            return null;
        const segments = normalizeRepoPath(path).split('/').filter(Boolean);
        if (segments.length < 2)
            return null;
        return segments.slice(0, segmentLimit).join('/');
    }
    // URL-like
    try {
        const url = new URL(remoteUrl);
        if (!isHostMatch(url.hostname, expectedHostname))
            return null;
        const segments = normalizeRepoPath(url.pathname).split('/').filter(Boolean);
        if (segments.length < 2)
            return null;
        return segments.slice(0, segmentLimit).join('/');
    }
    catch {
        return null;
    }
}
function normalizeRepoPath(s) {
    return s.replace(/^\/+|\/+$|\.git$/g, '');
}
function normalizeHostname(hostname) {
    return hostname
        .toLowerCase()
        .replace(/^ssh\./, '')
        .split(':')[0];
}
function isHostMatch(actual, expected) {
    return normalizeHostname(actual) === normalizeHostname(expected);
}
