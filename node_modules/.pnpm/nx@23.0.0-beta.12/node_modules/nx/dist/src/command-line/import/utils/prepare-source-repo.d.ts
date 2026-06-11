import { GitRepository } from '../../../utils/git-utils';
export declare function prepareSourceRepo(gitClient: GitRepository, ref: string, source: string, relativeDestination: string, tempImportBranch: string, sourceRemoteUrl: string): Promise<void>;
