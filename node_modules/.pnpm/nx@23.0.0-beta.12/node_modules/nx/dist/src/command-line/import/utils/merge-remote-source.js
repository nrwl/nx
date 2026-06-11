"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mergeRemoteSource = mergeRemoteSource;
const createSpinner = require('ora');
async function mergeRemoteSource(destinationGitClient, sourceRemoteUrl, tempBranch, destination, remoteName, branchName) {
    const spinner = createSpinner();
    spinner.start(`Merging ${branchName} from ${sourceRemoteUrl} into ${destination}`);
    spinner.start(`Fetching ${tempBranch} from ${remoteName}`);
    await destinationGitClient.fetch(remoteName, tempBranch);
    spinner.succeed(`Fetched ${tempBranch} from ${remoteName}`);
    spinner.start(`Merging files and git history from ${branchName} from ${sourceRemoteUrl} into ${destination}`);
    await destinationGitClient.mergeUnrelatedHistories(`${remoteName}/${tempBranch}`, `feat(repo): merge ${branchName} from ${sourceRemoteUrl}`);
    spinner.succeed(`Merged files and git history from ${branchName} from ${sourceRemoteUrl} into ${destination}`);
}
