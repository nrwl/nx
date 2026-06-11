"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RemoteReleaseClient = void 0;
exports.createRemoteReleaseClient = createRemoteReleaseClient;
const tslib_1 = require("tslib");
const axios_1 = tslib_1.__importDefault(require("axios"));
const handle_import_1 = require("../../../../utils/handle-import");
const print_changes_1 = require("../print-changes");
const shared_1 = require("../shared");
/**
 * Abstract base class for remote release clients
 */
class RemoteReleaseClient {
    constructor(
    // A workspace isn't guaranteed to have a remote
    remoteRepoData, createReleaseConfig, tokenData) {
        this.remoteRepoData = remoteRepoData;
        this.createReleaseConfig = createReleaseConfig;
        this.tokenData = tokenData;
        this.tokenHeader = {};
        if (tokenData) {
            if (tokenData.headerName === 'Authorization') {
                this.tokenHeader[tokenData.headerName] = `Bearer ${tokenData.token}`;
            }
            else {
                this.tokenHeader[tokenData.headerName] = tokenData.token;
            }
        }
    }
    getRemoteRepoData() {
        return this.remoteRepoData;
    }
    /**
     * Make an (optionally authenticated) API request to the remote release provider
     */
    async makeRequest(url, opts = {}) {
        const remoteRepoData = this.getRemoteRepoData();
        if (!remoteRepoData) {
            throw new Error(`No remote repo data could be resolved for the current workspace`);
        }
        const config = {
            ...opts,
            baseURL: remoteRepoData.apiBaseUrl,
            headers: {
                ...opts.headers,
                ...this.tokenHeader,
            },
        };
        return (await (0, axios_1.default)(url, config)).data;
    }
    async createOrUpdateRelease(releaseVersion, changelogContents, latestCommit, { dryRun }) {
        let existingRelease;
        try {
            existingRelease = await this.getReleaseByTag(releaseVersion.gitTag);
        }
        catch (err) {
            if (err.response?.status === 401) {
                this.handleAuthError();
                process.exit(1);
            }
            if (err.response?.status === 404) {
                // No existing release found, this is fine
            }
            else {
                // Rethrow unknown errors for now
                throw err;
            }
        }
        this.logReleaseAction(existingRelease, releaseVersion.gitTag, dryRun);
        this.printRemoteReleaseContents(existingRelease
            ? 'body' in existingRelease
                ? existingRelease.body
                : 'description' in existingRelease
                    ? existingRelease.description
                    : ''
            : '', changelogContents);
        if (!dryRun) {
            const remoteReleaseOptions = {
                version: releaseVersion.gitTag,
                prerelease: releaseVersion.isPrerelease,
                body: changelogContents,
                commit: latestCommit,
            };
            const result = await this.syncRelease(remoteReleaseOptions, existingRelease);
            if (result.status === 'manual') {
                await this.handleError(result.error, result);
            }
        }
    }
    /**
     * Format references for the release (e.g., PRs, issues)
     */
    formatReferences(_references) {
        // Base implementation - to be overridden by specific providers
        return '';
    }
    /**
     * Print changelog changes
     */
    printRemoteReleaseContents(existingBody, newBody) {
        console.log('');
        (0, print_changes_1.printDiff)(existingBody, newBody, 3, shared_1.noDiffInChangelogMessage);
    }
}
exports.RemoteReleaseClient = RemoteReleaseClient;
/**
 * Factory function to create a remote release client based on the given configuration
 */
async function createRemoteReleaseClient(createReleaseConfig, remoteName = 'origin') {
    switch (true) {
        // GitHub and GitHub Enterprise Server
        case typeof createReleaseConfig === 'object' &&
            (createReleaseConfig.provider === 'github-enterprise-server' ||
                createReleaseConfig.provider === 'github'):
        // If remote releases are disabled, assume GitHub repo data resolution (but don't attempt to resolve a token) to match existing behavior
        case createReleaseConfig === false: {
            const { GithubRemoteReleaseClient } = await (0, handle_import_1.handleImport)('./github.js', __dirname);
            const repoData = GithubRemoteReleaseClient.resolveRepoData(createReleaseConfig, remoteName);
            const token = createReleaseConfig && repoData
                ? await GithubRemoteReleaseClient.resolveTokenData(repoData.hostname)
                : null;
            return new GithubRemoteReleaseClient(repoData, createReleaseConfig, token);
        }
        // GitLab
        case typeof createReleaseConfig === 'object' &&
            createReleaseConfig.provider === 'gitlab':
            {
                const { GitLabRemoteReleaseClient } = await (0, handle_import_1.handleImport)('./gitlab.js', __dirname);
                const repoData = GitLabRemoteReleaseClient.resolveRepoData(createReleaseConfig, remoteName);
                const tokenData = repoData
                    ? await GitLabRemoteReleaseClient.resolveTokenData(repoData.hostname)
                    : null;
                return new GitLabRemoteReleaseClient(repoData, createReleaseConfig, tokenData);
            }
        default:
            throw new Error(`Unsupported remote release configuration: ${JSON.stringify(createReleaseConfig)}`);
    }
}
