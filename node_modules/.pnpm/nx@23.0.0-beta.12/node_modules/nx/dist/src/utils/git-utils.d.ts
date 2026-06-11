export declare function cloneFromUpstream(url: string, destination: string, { originName, depth }?: {
    originName: string;
    depth?: number;
}): Promise<GitRepository>;
export declare class GitRepository {
    private directory;
    root: string;
    constructor(directory: string);
    getGitRootPath(cwd: string): string;
    hasUncommittedChanges(): Promise<boolean>;
    addFetchRemote(remoteName: string, branch: string): Promise<string>;
    showStat(): Promise<string>;
    listBranches(): Promise<string[]>;
    getGitFiles(path: string): Promise<string[]>;
    reset(ref: string): Promise<string>;
    mergeUnrelatedHistories(ref: string, message: string): Promise<string>;
    fetch(remote: string, ref?: string): Promise<string>;
    checkout(branch: string, opts: {
        new: boolean;
        base: string;
    }): Promise<string>;
    move(path: string, destination: string): Promise<string>;
    push(ref: string, remoteName: string): Promise<string>;
    commit(message: string): Promise<string>;
    amendCommit(): Promise<string>;
    deleteGitRemote(name: string): Promise<string>;
    addGitRemote(name: string, url: string): Promise<string>;
    hasFilterRepoInstalled(): Promise<boolean>;
    filterRepo(source: string, destination: string): Promise<void>;
    filterBranch(source: string, destination: string, branchName: string): Promise<void>;
    private execAsync;
    private quotePath;
    private quoteArg;
}
export interface VcsRemoteInfo {
    domain: string;
    slug: string;
}
export declare function parseVcsRemoteUrl(url: string): VcsRemoteInfo | null;
export declare function getVcsRemoteInfo(directory?: string): VcsRemoteInfo | null;
export declare function commitChanges(commitMessage: string, directory?: string): string | null;
export declare function getLatestCommitSha(directory?: string): string | null;
