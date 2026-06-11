"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GitLabRemoteReleaseClient = exports.defaultCreateReleaseProvider = void 0;
const tslib_1 = require("tslib");
const pc = tslib_1.__importStar(require("picocolors"));
const enquirer_1 = require("enquirer");
const node_child_process_1 = require("node:child_process");
const output_1 = require("../../../../utils/output");
const extract_repo_slug_1 = require("./extract-repo-slug");
const remote_release_client_1 = require("./remote-release-client");
exports.defaultCreateReleaseProvider = {
    provider: 'gitlab',
    hostname: 'gitlab.com',
    apiBaseUrl: 'https://gitlab.com/api/v4',
};
class GitLabRemoteReleaseClient extends remote_release_client_1.RemoteReleaseClient {
    constructor() {
        super(...arguments);
        this.remoteReleaseProviderName = 'GitLab';
    }
    /**
     * Get GitLab repository data from git remote
     */
    static resolveRepoData(createReleaseConfig, remoteName = 'origin') {
        try {
            const remoteUrl = (0, node_child_process_1.execSync)(`git remote get-url ${remoteName}`, {
                encoding: 'utf8',
                stdio: 'pipe',
                windowsHide: true,
            }).trim();
            // Use the default provider if custom one is not specified or releases are disabled
            let hostname = exports.defaultCreateReleaseProvider.hostname;
            let apiBaseUrl = exports.defaultCreateReleaseProvider.apiBaseUrl;
            if (createReleaseConfig !== false &&
                typeof createReleaseConfig !== 'string') {
                hostname = createReleaseConfig.hostname || hostname;
                apiBaseUrl = createReleaseConfig.apiBaseUrl;
            }
            const slug = (0, extract_repo_slug_1.extractGitLabRepoSlug)(remoteUrl, hostname);
            if (slug) {
                // Encode the project path for use in API URLs
                const projectId = encodeURIComponent(slug);
                return {
                    hostname,
                    apiBaseUrl,
                    slug,
                    projectId,
                };
            }
            else {
                throw new Error(`Could not extract project path data from the resolved remote URL: ${remoteUrl}`);
            }
        }
        catch (err) {
            if (process.env.NX_VERBOSE_LOGGING === 'true') {
                console.error(err);
            }
            return null;
        }
    }
    /**
     * Resolve a GitLab token from various environment variables
     */
    static async resolveTokenData(hostname) {
        // Try and resolve from the environment
        const tokenFromEnv = process.env.GITLAB_TOKEN || process.env.GL_TOKEN;
        if (tokenFromEnv) {
            return { token: tokenFromEnv, headerName: 'PRIVATE-TOKEN' };
        }
        // Try and resolve from a CI environment
        if (process.env.CI_JOB_TOKEN) {
            return { token: process.env.CI_JOB_TOKEN, headerName: 'JOB-TOKEN' };
        }
        if (hostname !== 'gitlab.com') {
            console.log(`Warning: It was not possible to automatically resolve a GitLab token from your environment for hostname ${hostname}. If you set the GITLAB_TOKEN or GL_TOKEN environment variable (or you are in GitLab CI where CI_JOB_TOKEN is set automatically), that will be used for GitLab API requests.`);
        }
        return null;
    }
    createPostGitTask(releaseVersion, changelogContents, dryRun) {
        return async (latestCommit) => {
            output_1.output.logSingleLine(`Creating GitLab Release`);
            await this.createOrUpdateRelease(releaseVersion, changelogContents, latestCommit, { dryRun });
        };
    }
    // Not implemented for GitLab yet, the changelog renderer should not call this method
    async applyUsernameToAuthors() {
        throw new Error('applyUsernameToAuthors is not implemented for GitLab yet');
    }
    async getReleaseByTag(tag) {
        const gitlabRepoData = this.getRequiredRemoteRepoData();
        return await this.makeRequest(`/projects/${gitlabRepoData.projectId}/releases/${encodeURIComponent(tag)}`);
    }
    async createRelease(remoteRelease) {
        const gitlabRepoData = this.getRequiredRemoteRepoData();
        return await this.makeRequest(`/projects/${gitlabRepoData.projectId}/releases`, {
            method: 'POST',
            data: remoteRelease,
        });
    }
    async updateRelease(_id, remoteRelease) {
        const gitlabRepoData = this.getRequiredRemoteRepoData();
        return await this.makeRequest(`/projects/${gitlabRepoData.projectId}/releases/${encodeURIComponent(remoteRelease.tag_name)}`, {
            method: 'PUT',
            data: remoteRelease,
        });
    }
    /**
     * Generate a URL for manual release creation on GitLab. Sadly, unlike GitHub, GitLab does not
     * seem to respect query string parameters for setting the UI form fields, so the user has to
     * start from scratch.
     */
    getManualRemoteReleaseURL(_remoteReleaseOptions) {
        const gitlabRepoData = this.getRequiredRemoteRepoData();
        return `https://${gitlabRepoData.hostname}/${gitlabRepoData.slug}/-/releases/new`;
    }
    handleAuthError() {
        output_1.output.error({
            title: `Unable to resolve data via the GitLab API.`,
            bodyLines: [
                '- Set the `GITLAB_TOKEN` or `GL_TOKEN` environment variable to a valid GitLab token with `api` scope',
                '- If running in GitLab CI, the automatically provisioned CI_JOB_TOKEN can also be used',
            ],
        });
    }
    logReleaseAction(existingRelease, gitTag, dryRun) {
        const gitlabRepoData = this.getRequiredRemoteRepoData();
        const logTitle = `https://${gitlabRepoData.hostname}/${gitlabRepoData.slug}/-/releases/${encodeURIComponent(gitTag)}`;
        if (existingRelease) {
            console.error(`${pc.white('UPDATE')} ${logTitle}${dryRun ? (0, output_1.orange)(' [dry-run]') : ''}`);
        }
        else {
            console.error(`${pc.green('CREATE')} ${logTitle}${dryRun ? (0, output_1.orange)(' [dry-run]') : ''}`);
        }
    }
    async handleError(error, result) {
        if (error) {
            process.exitCode = 1;
            if (error.response?.data) {
                output_1.output.error({
                    title: `A GitLab API Error occurred when creating/updating the release`,
                    bodyLines: [
                        `GitLab Error: ${JSON.stringify(error.response.data)}`,
                        `---`,
                        `Request Data:`,
                        `Repo: ${this.getRemoteRepoData()?.slug}`,
                        `Token Header Data: ${this.tokenHeader}`,
                        `Body: ${JSON.stringify(result.requestData)}`,
                    ],
                });
            }
            else {
                console.log(error);
                console.error(`An unknown error occurred while trying to create a release on GitLab, please report this on https://github.com/nrwl/nx (NOTE: make sure to redact your GitLab token from the error message!)`);
            }
        }
        const shouldContinueInGitLab = await this.promptForContinueInGitLab();
        if (!shouldContinueInGitLab) {
            return;
        }
        const open = require('open');
        await open(result.url)
            .then(() => {
            console.info(`\nFollow up in the browser to manually create the release:\n\n` +
                pc.underline(pc.cyan(result.url)) +
                `\n`);
        })
            .catch(() => {
            console.info(`Open this link to manually create a release: \n` +
                pc.underline(pc.cyan(result.url)) +
                '\n');
        });
    }
    async promptForContinueInGitLab() {
        try {
            const reply = await (0, enquirer_1.prompt)([
                {
                    name: 'open',
                    message: 'Do you want to create the release manually in your browser?',
                    type: 'autocomplete',
                    choices: [
                        {
                            name: 'Yes',
                            hint: 'It will open the GitLab release page for you',
                        },
                        {
                            name: 'No',
                        },
                    ],
                    initial: 0,
                },
            ]);
            return reply.open === 'Yes';
        }
        catch {
            // Ensure the cursor is always restored before exiting
            process.stdout.write('\u001b[?25h');
            // Handle the case where the user exits the prompt with ctrl+c
            process.exit(1);
        }
    }
    /**
     * Format references for the release (e.g., MRs, issues)
     */
    formatReferences(references) {
        const gitlabRepoData = this.getRequiredRemoteRepoData();
        const providerToRefSpec = {
            gitlab: {
                'pull-request': 'merge_requests',
                hash: 'commit',
                issue: 'issues',
            },
        };
        const refSpec = providerToRefSpec.gitlab;
        const formatSingleReference = (ref) => {
            return `https://${gitlabRepoData.hostname}/${gitlabRepoData.slug}/-/${refSpec[ref.type]}/${ref.value.replace(/^[#!]/, '')}`;
        };
        const mr = references.filter((ref) => ref.type === 'pull-request');
        const issue = references.filter((ref) => ref.type === 'issue');
        if (mr.length > 0 || issue.length > 0) {
            return (' (' +
                [...mr, ...issue].map((ref) => formatSingleReference(ref)).join(', ') +
                ')');
        }
        if (references.length > 0) {
            return ' (' + formatSingleReference(references[0]) + ')';
        }
        return '';
    }
    async syncRelease(remoteReleaseOptions, existingRelease) {
        const gitlabReleaseData = {
            tag_name: remoteReleaseOptions.version,
            name: remoteReleaseOptions.version,
            description: remoteReleaseOptions.body,
            prerelease: remoteReleaseOptions.prerelease,
            ref: remoteReleaseOptions.commit,
            released_at: new Date().toISOString(),
            assets: { links: [] },
            milestones: [],
        };
        try {
            const newGlRelease = await (existingRelease
                ? this.updateRelease(existingRelease.id, gitlabReleaseData)
                : this.createRelease(gitlabReleaseData));
            const gitlabRepoData = this.getRequiredRemoteRepoData();
            return {
                status: existingRelease ? 'updated' : 'created',
                id: newGlRelease.tag_name,
                url: `https://${gitlabRepoData.hostname}/${gitlabRepoData.slug}/-/tags/${encodeURIComponent(remoteReleaseOptions.version)}`,
            };
        }
        catch (error) {
            return {
                status: 'manual',
                error,
                url: this.getManualRemoteReleaseURL(remoteReleaseOptions),
                requestData: gitlabReleaseData,
            };
        }
    }
    getRequiredRemoteRepoData() {
        const gitlabRepoData = this.getRemoteRepoData();
        if (!gitlabRepoData) {
            throw new Error(`No remote repo data could be resolved for the current workspace`);
        }
        return gitlabRepoData;
    }
}
exports.GitLabRemoteReleaseClient = GitLabRemoteReleaseClient;
