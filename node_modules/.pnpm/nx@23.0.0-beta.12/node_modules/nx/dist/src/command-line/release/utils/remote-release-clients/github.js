"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GithubRemoteReleaseClient = exports.defaultCreateReleaseProvider = void 0;
const tslib_1 = require("tslib");
const pc = tslib_1.__importStar(require("picocolors"));
const enquirer_1 = require("enquirer");
const node_child_process_1 = require("node:child_process");
const node_fs_1 = require("node:fs");
const node_os_1 = require("node:os");
const output_1 = require("../../../../utils/output");
const path_1 = require("../../../../utils/path");
const extract_repo_slug_1 = require("./extract-repo-slug");
const remote_release_client_1 = require("./remote-release-client");
// Use default import with esModuleInterop
const axios_1 = tslib_1.__importDefault(require("axios"));
exports.defaultCreateReleaseProvider = {
    provider: 'github',
    hostname: 'github.com',
    apiBaseUrl: 'https://api.github.com',
};
class GithubRemoteReleaseClient extends remote_release_client_1.RemoteReleaseClient {
    constructor() {
        super(...arguments);
        this.remoteReleaseProviderName = 'GitHub';
    }
    /**
     * Get GitHub repository data from git remote
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
            const slug = (0, extract_repo_slug_1.extractGitHubRepoSlug)(remoteUrl, hostname);
            if (slug) {
                return { hostname, apiBaseUrl, slug };
            }
            else {
                throw new Error(`Could not extract "user/repo" data from the resolved remote URL: ${remoteUrl}`);
            }
        }
        catch (error) {
            if (process.env.NX_VERBOSE_LOGGING === 'true') {
                console.error(error);
            }
            return null;
        }
    }
    /**
     * Resolve a GitHub token from environment variables or gh CLI
     */
    static async resolveTokenData(hostname) {
        // Try and resolve from the environment
        const tokenFromEnv = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
        if (tokenFromEnv) {
            return { token: tokenFromEnv, headerName: 'Authorization' };
        }
        // Try and resolve from gh CLI installation
        const ghCLIPath = (0, path_1.joinPathFragments)(process.env.XDG_CONFIG_HOME || (0, path_1.joinPathFragments)((0, node_os_1.homedir)(), '.config'), 'gh', 'hosts.yml');
        if ((0, node_fs_1.existsSync)(ghCLIPath)) {
            const yamlContents = await node_fs_1.promises.readFile(ghCLIPath, 'utf8');
            const { load } = require('@zkochan/js-yaml');
            const ghCLIConfig = load(yamlContents);
            if (ghCLIConfig[hostname]) {
                // Web based session (the token is already embedded in the config)
                if (ghCLIConfig[hostname].oauth_token) {
                    return ghCLIConfig[hostname].oauth_token;
                }
                // SSH/HTTPS based session (we need to dynamically resolve a token using the CLI)
                if (ghCLIConfig[hostname].user &&
                    (ghCLIConfig[hostname].git_protocol === 'ssh' ||
                        ghCLIConfig[hostname].git_protocol === 'https')) {
                    const token = (0, node_child_process_1.execSync)(`gh auth token`, {
                        encoding: 'utf8',
                        stdio: 'pipe',
                        windowsHide: true,
                    }).trim();
                    return { token, headerName: 'Authorization' };
                }
            }
        }
        if (hostname !== 'github.com') {
            console.log(`Warning: It was not possible to automatically resolve a GitHub token from your environment for hostname ${hostname}. If you set the GITHUB_TOKEN or GH_TOKEN environment variable, that will be used for GitHub API requests.`);
        }
        return null;
    }
    createPostGitTask(releaseVersion, changelogContents, dryRun) {
        return async (latestCommit) => {
            output_1.output.logSingleLine(`Creating GitHub Release`);
            await this.createOrUpdateRelease(releaseVersion, changelogContents, latestCommit, { dryRun });
        };
    }
    async applyUsernameToAuthors(authors) {
        await Promise.all([...authors.keys()].map(async (authorName) => {
            const meta = authors.get(authorName);
            for (const email of meta.email) {
                if (email.endsWith('@users.noreply.github.com')) {
                    const match = email.match(/^(\d+\+)?([^@]+)@users\.noreply\.github\.com$/);
                    if (match && match[2]) {
                        meta.username = match[2];
                        break;
                    }
                }
                const { data } = await axios_1.default
                    .get(`https://ungh.cc/users/find/${email}`)
                    .catch(() => ({ data: { user: null } }));
                if (data?.user?.username) {
                    meta.username = data.user.username;
                    break;
                }
                const usernameFromGhCli = this.resolveUsernameFromGhCli(email);
                if (usernameFromGhCli) {
                    meta.username = usernameFromGhCli;
                    break;
                }
            }
        }));
    }
    resolveUsernameFromGhCli(email) {
        const hostname = this.getRemoteRepoData()?.hostname ??
            exports.defaultCreateReleaseProvider.hostname;
        try {
            const stdout = (0, node_child_process_1.execFileSync)('gh', [
                'api',
                '--hostname',
                hostname,
                '--method',
                'GET',
                'search/users',
                '-f',
                `q=${email} in:email`,
            ], {
                encoding: 'utf8',
                stdio: 'pipe',
                windowsHide: true,
            }).trim();
            if (!stdout) {
                return null;
            }
            const data = JSON.parse(stdout);
            return data.items?.[0]?.login ?? null;
        }
        catch (error) {
            if (process.env.NX_VERBOSE_LOGGING === 'true') {
                console.error(error);
            }
            return null;
        }
    }
    /**
     * Get a release by tag
     */
    async getReleaseByTag(tag) {
        const githubRepoData = this.getRequiredRemoteRepoData();
        return await this.makeRequest(`/repos/${githubRepoData.slug}/releases/tags/${tag}`);
    }
    /**
     * Create a new release
     */
    async createRelease(remoteRelease) {
        const githubRepoData = this.getRequiredRemoteRepoData();
        return await this.makeRequest(`/repos/${githubRepoData.slug}/releases`, {
            method: 'POST',
            data: remoteRelease,
        });
    }
    async updateRelease(id, remoteRelease) {
        const githubRepoData = this.getRequiredRemoteRepoData();
        return await this.makeRequest(`/repos/${githubRepoData.slug}/releases/${id}`, {
            method: 'PATCH',
            data: remoteRelease,
        });
    }
    getManualRemoteReleaseURL(remoteReleaseOptions) {
        const githubRepoData = this.getRequiredRemoteRepoData();
        // Parameters taken from https://github.com/isaacs/github/issues/1410#issuecomment-442240267
        let url = `https://${githubRepoData.hostname}/${githubRepoData.slug}/releases/new?tag=${remoteReleaseOptions.version}&title=${remoteReleaseOptions.version}&body=${encodeURIComponent(remoteReleaseOptions.body)}&target=${remoteReleaseOptions.commit}`;
        if (remoteReleaseOptions.prerelease) {
            url += '&prerelease=true';
        }
        return url;
    }
    handleAuthError() {
        output_1.output.error({
            title: `Unable to resolve data via the GitHub API. You can use any of the following options to resolve this:`,
            bodyLines: [
                '- Set the `GITHUB_TOKEN` or `GH_TOKEN` environment variable to a valid GitHub token with `repo` scope',
                '- Have an active session via the official gh CLI tool (https://cli.github.com) in your current terminal',
            ],
        });
    }
    logReleaseAction(existingRelease, gitTag, dryRun) {
        const githubRepoData = this.getRequiredRemoteRepoData();
        const logTitle = `https://${githubRepoData.hostname}/${githubRepoData.slug}/releases/tag/${gitTag}`;
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
                // There's a nicely formatted error from GitHub we can display to the user
                output_1.output.error({
                    title: `A GitHub API Error occurred when creating/updating the release`,
                    bodyLines: [
                        `GitHub Error: ${JSON.stringify(error.response.data)}`,
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
                console.error(`An unknown error occurred while trying to create a release on GitHub, please report this on https://github.com/nrwl/nx (NOTE: make sure to redact your GitHub token from the error message!)`);
            }
        }
        const shouldContinueInGitHub = await this.promptForContinueInGitHub();
        if (!shouldContinueInGitHub) {
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
    async promptForContinueInGitHub() {
        try {
            const reply = await (0, enquirer_1.prompt)([
                {
                    name: 'open',
                    message: 'Do you want to finish creating the release manually in your browser?',
                    type: 'autocomplete',
                    choices: [
                        {
                            name: 'Yes',
                            hint: 'It will pre-populate the form for you',
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
     * Format references for the release (e.g., PRs, issues)
     */
    formatReferences(references) {
        const githubRepoData = this.getRequiredRemoteRepoData();
        const providerToRefSpec = {
            github: { 'pull-request': 'pull', hash: 'commit', issue: 'issues' },
        };
        const refSpec = providerToRefSpec.github;
        const formatSingleReference = (ref) => {
            return `[${ref.value}](https://${githubRepoData.hostname}/${githubRepoData.slug}/${refSpec[ref.type]}/${ref.value.replace(/^#/, '')})`;
        };
        const pr = references.filter((ref) => ref.type === 'pull-request');
        const issue = references.filter((ref) => ref.type === 'issue');
        if (pr.length > 0 || issue.length > 0) {
            return (' (' +
                [...pr, ...issue].map((ref) => formatSingleReference(ref)).join(', ') +
                ')');
        }
        if (references.length > 0) {
            return ' (' + formatSingleReference(references[0]) + ')';
        }
        return '';
    }
    async syncRelease(remoteReleaseOptions, existingRelease) {
        const githubReleaseData = {
            tag_name: remoteReleaseOptions.version,
            name: remoteReleaseOptions.version,
            body: remoteReleaseOptions.body,
            prerelease: remoteReleaseOptions.prerelease,
            // legacy specifies that the latest release should be determined based on the release creation date and higher semantic version.
            make_latest: 'legacy',
        };
        try {
            const newGhRelease = await (existingRelease
                ? this.updateRelease(existingRelease.id, githubReleaseData)
                : this.createRelease({
                    ...githubReleaseData,
                    target_commitish: remoteReleaseOptions.commit,
                }));
            return {
                status: existingRelease ? 'updated' : 'created',
                id: newGhRelease.id,
                url: newGhRelease.html_url,
            };
        }
        catch (error) {
            return {
                status: 'manual',
                error,
                url: this.getManualRemoteReleaseURL(remoteReleaseOptions),
                requestData: githubReleaseData,
            };
        }
    }
    getRequiredRemoteRepoData() {
        const githubRepoData = this.getRemoteRepoData();
        if (!githubRepoData) {
            throw new Error(`No remote repo data could be resolved for the current workspace`);
        }
        return githubRepoData;
    }
}
exports.GithubRemoteReleaseClient = GithubRemoteReleaseClient;
