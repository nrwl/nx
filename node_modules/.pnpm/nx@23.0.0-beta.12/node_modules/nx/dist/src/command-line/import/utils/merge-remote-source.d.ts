import { GitRepository } from '../../../utils/git-utils';
export declare function mergeRemoteSource(destinationGitClient: GitRepository, sourceRemoteUrl: string, tempBranch: string, destination: string, remoteName: string, branchName: string): Promise<void>;
