import * as chalk from 'chalk';
import { logger } from '../../utils/logger';
import { commitChanges } from '../../utils/git-utils';

export function commitNxConnectUpdates(
  connectUrl: string,
  isGitHub: boolean,
  installationSource: string
) {
  const commitHeadline =
    installationSource === 'nx-init'
      ? `feat(nx): init nx and connect to nx cloud`
      : `feat(nx-cloud): connect to nx cloud`;

  const commitMessage = `${commitHeadline}

  This commit set up Nx Cloud for your Nx workspace enabling distributed caching${
    isGitHub
      ? ` and GitHub integration for fast CI and imporved developer experience.`
      : '.'
  }

  You can access your Nx Cloud workspace by going to:

    ${connectUrl}
  `;
  try {
    const committedSha = commitChanges(commitMessage);

    if (committedSha) {
      logger.info(chalk.dim(`- Commit created for changes: ${committedSha}`));
    } else {
      logger.info(
        chalk.red(
          `- A commit could not be created/retrieved for an unknown reason`
        )
      );
    }
  } catch (e) {
    logger.info(chalk.red(`- ${e.message}`));
  }
}
