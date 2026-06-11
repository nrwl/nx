"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prepareSourceRepo = prepareSourceRepo;
const createSpinner = require('ora');
const path_1 = require("path");
async function prepareSourceRepo(gitClient, ref, source, relativeDestination, tempImportBranch, sourceRemoteUrl) {
    const spinner = createSpinner().start(`Fetching ${ref} from ${sourceRemoteUrl}`);
    const relativeSourceDir = (0, path_1.relative)(gitClient.root, (0, path_1.join)(gitClient.root, source));
    const message = relativeSourceDir.trim()
        ? `Filtering git history to only include files in ${relativeSourceDir}`
        : `Filtering git history`;
    if (await gitClient.hasFilterRepoInstalled()) {
        spinner.start(message);
        await gitClient.filterRepo(relativeSourceDir, relativeDestination);
    }
    else {
        spinner.start(`${message} (this might take a few minutes -- install git-filter-repo for faster performance)`);
        await gitClient.filterBranch(relativeSourceDir, relativeDestination, tempImportBranch);
    }
    spinner.succeed(relativeSourceDir.trim()
        ? `Filtered git history to only include files in ${relativeSourceDir}`
        : `Filtered git history`);
    spinner.succeed(`${sourceRemoteUrl} has been prepared to be imported into this workspace on a temporary branch: ${tempImportBranch} in ${gitClient.root}`);
}
function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
