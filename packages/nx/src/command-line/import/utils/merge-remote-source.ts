import { GitRepository } from '../../../utils/git-utils';
import { Spinner } from 'picospinner';

export async function mergeRemoteSource(
  destinationGitClient: GitRepository,
  sourceRemoteUrl: string,
  tempBranch: string,
  destination: string,
  remoteName: string,
  branchName: string
) {
  const spinner = new Spinner(
    `Merging ${branchName} from ${sourceRemoteUrl} into ${destination}`
  );

  spinner.setText(`Fetching ${tempBranch} from ${remoteName}`);
  spinner.start();
  await destinationGitClient.fetch(remoteName, tempBranch);
  spinner.succeed(`Fetched ${tempBranch} from ${remoteName}`);

  spinner.setText(
    `Merging files and git history from ${branchName} from ${sourceRemoteUrl} into ${destination}`
  );
  spinner.start();
  await destinationGitClient.mergeUnrelatedHistories(
    `${remoteName}/${tempBranch}`,
    `feat(repo): merge ${branchName} from ${sourceRemoteUrl}`
  );

  spinner.succeed(
    `Merged files and git history from ${branchName} from ${sourceRemoteUrl} into ${destination}`
  );
}
