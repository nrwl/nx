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

  if (relativeSourceDir !== '') {
    if (await gitClient.hasFilterRepoInstalled()) {
      spinner.start(
        `Filtering git history to only include files in ${relativeSourceDir}`
      );
      await gitClient.filterRepo(relativeSourceDir);
    } else {
      spinner.start(
        `Filtering git history to only include files in ${relativeSourceDir} (this might take a few minutes -- install git-filter-repo for faster performance)`
      );
      await gitClient.filterBranch(relativeSourceDir, tempImportBranch);
    }
    spinner.succeed(
      `Filtered git history to only include files in ${relativeSourceDir}`
    );
  }

  const destinationInSource = join(gitClient.root, relativeDestination);
  spinner.start(`Moving files and git history to ${destinationInSource}`);

  // The result of filter-branch will contain only the files in the subdirectory at its root.
  const files = await gitClient.getGitFiles('.');
  try {
    await rm(destinationInSource, {
      recursive: true,
    });
  } catch {}
  await mkdir(destinationInSource, { recursive: true });
  for (const file of files) {
    spinner.start(
      `Moving files and git history to ${destinationInSource}: ${file}`
    );

    const newPath = join(destinationInSource, file);

    await mkdir(dirname(newPath), { recursive: true });
    try {
      await gitClient.move(file, newPath);
    } catch {
      await wait(100);
      await gitClient.move(file, newPath);
    }
  }

  await gitClient.commit(
    `chore(repo): move ${source} to ${relativeDestination} to prepare to be imported`
  );

  await gitClient.amendCommit();

  spinner.succeed(
    `${sourceRemoteUrl} has been prepared to be imported into this workspace on a temporary branch: ${tempImportBranch} in ${gitClient.root}`
  );
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
