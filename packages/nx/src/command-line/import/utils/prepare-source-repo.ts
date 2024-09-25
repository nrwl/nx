import * as createSpinner from 'ora';
import { dirname, join, relative } from 'path';
import { mkdir, rm } from 'node:fs/promises';
import { GitRepository } from '../../../utils/git-utils';

export async function prepareSourceRepo(
  gitClient: GitRepository,
  ref: string,
  source: string,
  relativeDestination: string,
  tempImportBranch: string,
  sourceRemoteUrl: string
) {
  const spinner = createSpinner().start(
    `Fetching ${ref} from ${sourceRemoteUrl}`
  );
  const relativeSourceDir = relative(
    gitClient.root,
    join(gitClient.root, source)
  );

  if (await gitClient.hasFilterRepoInstalled()) {
    spinner.start(
      `Filtering git history to only include files in ${relativeSourceDir}`
    );
    await gitClient.filterRepo(relativeSourceDir, relativeDestination);
  } else {
    spinner.start(
      `Filtering git history to only include files in ${relativeSourceDir} (this might take a few minutes -- install git-filter-repo for faster performance)`
    );
    await gitClient.filterBranch(
      relativeSourceDir,
      relativeDestination,
      tempImportBranch
    );
  }
  spinner.succeed(
    `Filtered git history to only include files in ${relativeSourceDir}`
  );

  spinner.succeed(
    `${sourceRemoteUrl} has been prepared to be imported into this workspace on a temporary branch: ${tempImportBranch} in ${gitClient.root}`
  );
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
