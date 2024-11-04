import { GitRepository } from '../../../utils/git-utils';
import * as createSpinner from 'ora';

export async function mergeRemoteSource(
  destinationGitClient: GitRepository,
  sourceRemoteUrl: string,
  tempBranch: string,
  destination: string,
  remoteName: string,
  branchName: string
) {
  const spinner = createSpinner();
  spinner.start(
    `Merging ${branchName} from ${sourceRemoteUrl} into ${destination}`
  );

  spinner.start(`Fetching ${tempBranch} from ${remoteName}`);
  await destinationGitClient.fetch(remoteName, tempBranch);
  spinner.succeed(`Fetched ${tempBranch} from ${remoteName}`);

  spinner.start(
    `Merging files and git history from ${branchName} from ${sourceRemoteUrl} into ${destination}`
  );
  await destinationGitClient.mergeUnrelatedHistories(
    `${remoteName}/${tempBranch}`,
    `feat(repo): merge ${branchName} from ${sourceRemoteUrl}`
  );

  spinner.succeed(
    `Merged files and git history from ${branchName} from ${sourceRemoteUrl} into ${destination}`
  );
}
