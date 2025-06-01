import { join, relative } from 'path';
import { createSpinner } from 'nanospinner';
import { GitRepository } from '../../../utils/git-utils';

export async function prepareSourceRepo(
  gitClient: GitRepository,
  ref: string,
  source: string,
  relativeDestination: string,
  tempImportBranch: string,
  sourceRemoteUrl: string
) {
  const spinner = createSpinner(`Fetching ${ref} from ${sourceRemoteUrl}`);
  spinner.start();
  const relativeSourceDir = relative(
    gitClient.root,
    join(gitClient.root, source)
  );

  const message = relativeSourceDir.trim()
    ? `Filtering git history to only include files in ${relativeSourceDir}`
    : `Filtering git history`;

  if (await gitClient.hasFilterRepoInstalled()) {
    spinner.write(message);
    await gitClient.filterRepo(relativeSourceDir, relativeDestination);
  } else {
    spinner.write(
      `${message} (this might take a few minutes -- install git-filter-repo for faster performance)`
    );
    await gitClient.filterBranch(
      relativeSourceDir,
      relativeDestination,
      tempImportBranch
    );
  }
  spinner.success(
    relativeSourceDir.trim()
      ? `Filtered git history to only include files in ${relativeSourceDir}`
      : `Filtered git history`
  );

  spinner.success(
    `${sourceRemoteUrl} has been prepared to be imported into this workspace on a temporary branch: ${tempImportBranch} in ${gitClient.root}`
  );
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
