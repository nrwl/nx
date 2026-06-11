"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GitRepository = void 0;
exports.cloneFromUpstream = cloneFromUpstream;
exports.parseVcsRemoteUrl = parseVcsRemoteUrl;
exports.getVcsRemoteInfo = getVcsRemoteInfo;
exports.commitChanges = commitChanges;
exports.getLatestCommitSha = getLatestCommitSha;
const child_process_1 = require("child_process");
const path_1 = require("path");
const logger_1 = require("./logger");
function execAsync(command, execOptions) {
    return new Promise((res, rej) => {
        (0, child_process_1.exec)(command, { ...execOptions, windowsHide: true }, (err, stdout, stderr) => {
            if (err) {
                return rej(err);
            }
            res(stdout.toString());
        });
    });
}
async function cloneFromUpstream(url, destination, { originName, depth } = {
    originName: 'origin',
}) {
    await execAsync(`git clone ${url} ${destination} ${depth ? `--depth ${depth}` : ''} --origin ${originName}`, {
        cwd: (0, path_1.dirname)(destination),
        maxBuffer: 10 * 1024 * 1024,
    });
    return new GitRepository(destination);
}
class GitRepository {
    constructor(directory) {
        this.directory = directory;
        this.root = this.getGitRootPath(this.directory);
    }
    getGitRootPath(cwd) {
        return (0, child_process_1.execSync)('git rev-parse --show-toplevel', {
            cwd,
            windowsHide: true,
        })
            .toString()
            .trim();
    }
    async hasUncommittedChanges() {
        const data = await this.execAsync(`git status --porcelain`);
        return data.trim() !== '';
    }
    async addFetchRemote(remoteName, branch) {
        return await this.execAsync(`git config --add remote.${remoteName}.fetch "+refs/heads/${branch}:refs/remotes/${remoteName}/${branch}"`);
    }
    async showStat() {
        return await this.execAsync(`git show --stat`);
    }
    async listBranches() {
        return (await this.execAsync(`git ls-remote --heads --quiet`))
            .trim()
            .split('\n')
            .map((s) => s
            .trim()
            .substring(s.indexOf('\t') + 1)
            .replace('refs/heads/', ''));
    }
    async getGitFiles(path) {
        // Use -z to return file names exactly as they are stored in git, separated by NULL (\x00) character.
        // This avoids problems with special characters in file names.
        return (await this.execAsync(`git ls-files -z ${path}`))
            .trim()
            .split('\x00')
            .map((s) => s.trim())
            .filter(Boolean);
    }
    async reset(ref) {
        return await this.execAsync(`git reset ${ref} --hard`);
    }
    async mergeUnrelatedHistories(ref, message) {
        return await this.execAsync(`git merge ${ref} -X ours --allow-unrelated-histories -m "${message}"`);
    }
    async fetch(remote, ref) {
        return await this.execAsync(`git fetch ${remote}${ref ? ` ${ref}` : ''}`);
    }
    async checkout(branch, opts) {
        return await this.execAsync(`git checkout ${opts.new ? '-b ' : ' '}${branch}${opts.base ? ' ' + opts.base : ''}`);
    }
    async move(path, destination) {
        return await this.execAsync(`git mv ${this.quotePath(path)} ${this.quotePath(destination)}`);
    }
    async push(ref, remoteName) {
        return await this.execAsync(`git push -u -f ${remoteName} ${ref}`);
    }
    async commit(message) {
        return await this.execAsync(`git commit -am "${message}"`);
    }
    async amendCommit() {
        return await this.execAsync(`git commit --amend -a --no-edit`);
    }
    async deleteGitRemote(name) {
        return await this.execAsync(`git remote rm ${name}`);
    }
    async addGitRemote(name, url) {
        return await this.execAsync(`git remote add ${name} ${url}`);
    }
    async hasFilterRepoInstalled() {
        try {
            await this.execAsync(`git filter-repo --help`);
            return true;
        }
        catch {
            return false;
        }
    }
    // git-filter-repo is much faster than filter-branch, but needs to be installed by user
    // Use `hasFilterRepoInstalled` to check if it's installed
    async filterRepo(source, destination) {
        // NOTE: filter-repo requires POSIX path to work
        const sourcePosixPath = source.split(path_1.sep).join(path_1.posix.sep);
        const destinationPosixPath = destination.split(path_1.sep).join(path_1.posix.sep);
        await this.execAsync(`git filter-repo -f ${source !== '' ? `--path ${this.quotePath(sourcePosixPath)}` : ''} ${source !== destination
            ? `--path-rename ${this.quotePath(sourcePosixPath, true)}:${this.quotePath(destinationPosixPath, true)}`
            : ''}`);
    }
    async filterBranch(source, destination, branchName) {
        // We need non-ASCII file names to not be quoted, or else filter-branch will exclude them.
        await this.execAsync(`git config core.quotepath false`);
        // NOTE: filter-repo requires POSIX path to work
        const sourcePosixPath = source.split(path_1.sep).join(path_1.posix.sep);
        const destinationPosixPath = destination.split(path_1.sep).join(path_1.posix.sep);
        // First, if the source is not a root project, then only include commits relevant to the subdirectory.
        if (source !== '') {
            const indexFilterCommand = this.quoteArg(`node ${(0, path_1.join)(__dirname, 'git-utils.index-filter.js')}`);
            await this.execAsync(`git filter-branch -f --index-filter ${indexFilterCommand} --prune-empty -- ${branchName}`, {
                NX_IMPORT_SOURCE: sourcePosixPath,
                NX_IMPORT_DESTINATION: destinationPosixPath,
            });
        }
        // Then, move files to their new location if necessary.
        if (source === '' || source !== destination) {
            const treeFilterCommand = this.quoteArg(`node ${(0, path_1.join)(__dirname, 'git-utils.tree-filter.js')}`);
            await this.execAsync(`git filter-branch -f --tree-filter ${treeFilterCommand} -- ${branchName}`, {
                NX_IMPORT_SOURCE: sourcePosixPath,
                NX_IMPORT_DESTINATION: destinationPosixPath,
            });
        }
    }
    execAsync(command, env) {
        return execAsync(command, {
            cwd: this.root,
            maxBuffer: 10 * 1024 * 1024,
            env: {
                ...process.env,
                ...env,
            },
        });
    }
    quotePath(path, ensureTrailingSlash) {
        return this.quoteArg(ensureTrailingSlash && path !== '' && !path.endsWith('/')
            ? `${path}/`
            : path);
    }
    quoteArg(arg) {
        return process.platform === 'win32'
            ? // Windows/CMD only understands double-quotes, single-quotes are treated as part of the file name
                // Bash and other shells will substitute `$` in file names with a variable value.
                `"${arg
                    // Need to keep two slashes for Windows or else the path will be invalid.
                    // e.g. 'C:\Users\bob\projects\repo' is invalid, but 'C:\\Users\\bob\\projects\\repo' is valid
                    .replaceAll('\\', '\\\\')}"`
            : // e.g. `git mv "$$file.txt" "libs/a/$$file.txt"` will not work since `$$` is swapped with the PID of the last process.
                // Using single-quotes prevents this substitution.
                `'${arg}'`;
    }
}
exports.GitRepository = GitRepository;
function parseVcsRemoteUrl(url) {
    // Remove whitespace and handle common URL formats
    const cleanUrl = url.trim();
    // SSH format: git@domain:owner/repo.git
    const sshMatch = cleanUrl.match(/^git@([^:]+):([^\/]+)\/(.+?)(\.git)?$/);
    if (sshMatch) {
        const [, domain, owner, repo] = sshMatch;
        return {
            domain,
            slug: `${owner}/${repo}`,
        };
    }
    // HTTPS with authentication: https://user@domain/owner/repo.git
    const httpsAuthMatch = cleanUrl.match(/^https?:\/\/[^@]+@([^\/]+)\/([^\/]+)\/(.+?)(\.git)?$/);
    if (httpsAuthMatch) {
        const [, domain, owner, repo] = httpsAuthMatch;
        return {
            domain,
            slug: `${owner}/${repo}`,
        };
    }
    // HTTPS format: https://domain/owner/repo.git (without authentication)
    const httpsMatch = cleanUrl.match(/^https?:\/\/([^@\/]+)\/([^\/]+)\/(.+?)(\.git)?$/);
    if (httpsMatch) {
        const [, domain, owner, repo] = httpsMatch;
        return {
            domain,
            slug: `${owner}/${repo}`,
        };
    }
    // SSH alternative format: ssh://git@domain/owner/repo.git or ssh://git@domain:port/owner/repo.git
    const sshAltMatch = cleanUrl.match(/^ssh:\/\/[^@]+@([^:\/]+)(:[0-9]+)?\/([^\/]+)\/(.+?)(\.git)?$/);
    if (sshAltMatch) {
        const [, domain, , owner, repo] = sshAltMatch;
        return {
            domain,
            slug: `${owner}/${repo}`,
        };
    }
    return null;
}
function getVcsRemoteInfo(directory) {
    try {
        const gitRemote = (0, child_process_1.execSync)('git remote -v', {
            stdio: 'pipe',
            windowsHide: true,
            cwd: directory,
        })
            .toString()
            .trim();
        if (!gitRemote || gitRemote.length === 0) {
            return null;
        }
        const lines = gitRemote.split('\n').filter((line) => line.trim());
        const remotesPriority = ['origin', 'upstream', 'base'];
        const foundRemotes = {};
        let firstRemote = null;
        for (const line of lines) {
            const match = line.trim().match(/^(\w+)\s+(\S+)\s+\((fetch|push)\)$/);
            if (match) {
                const [, remoteName, url] = match;
                const remoteInfo = parseVcsRemoteUrl(url);
                if (remoteInfo && !foundRemotes[remoteName]) {
                    foundRemotes[remoteName] = remoteInfo;
                    if (!firstRemote) {
                        firstRemote = remoteInfo;
                    }
                }
            }
        }
        // Return high-priority remote if found
        for (const remote of remotesPriority) {
            if (foundRemotes[remote]) {
                return foundRemotes[remote];
            }
        }
        // Return first found remote
        return firstRemote;
    }
    catch (e) {
        return null;
    }
}
function commitChanges(commitMessage, directory) {
    try {
        (0, child_process_1.execSync)('git add -A', {
            encoding: 'utf8',
            stdio: 'pipe',
            cwd: directory,
            windowsHide: true,
        });
        (0, child_process_1.execSync)('git commit --no-verify -F -', {
            encoding: 'utf8',
            stdio: 'pipe',
            input: commitMessage,
            cwd: directory,
            windowsHide: true,
        });
    }
    catch (err) {
        if (directory) {
            // We don't want to throw during create-nx-workspace
            // because maybe there was an error when setting up git
            // initially.
            logger_1.logger.verbose(`Git may not be set up correctly for this new workspace.
        ${err}`);
        }
        else {
            throw new Error(`Error committing changes:\n${err.stderr}`);
        }
    }
    return getLatestCommitSha(directory);
}
function getLatestCommitSha(directory) {
    try {
        return (0, child_process_1.execSync)('git rev-parse HEAD', {
            encoding: 'utf8',
            stdio: 'pipe',
            windowsHide: true,
            cwd: directory,
        }).trim();
    }
    catch {
        return null;
    }
}
