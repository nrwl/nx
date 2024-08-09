import * as createSpinner from 'ora';
import { basename, dirname, join, relative } from 'path';
import { GitRepository } from '../../../utils/git-utils';
import { promisify } from 'util';
import { copyFile, mkdir, rm } from 'fs';

const rmAsync = promisify(rm);
const copyFileAsync = promisify(copyFile);
const mkdirAsync = promisify(mkdir);

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
  await gitClient.addFetchRemote('origin', ref);
  await gitClient.fetch('origin', { depth: 1, ref });
  spinner.succeed(`Fetched ${ref} from ${sourceRemoteUrl}`);
  spinner.start(
    `Checking out a temporary branch, ${tempImportBranch} based on ${ref}`
  );
  await gitClient.checkout(tempImportBranch, {
    new: true,
    base: `origin/${ref}`,
  });
  spinner.succeed(`Created a ${tempImportBranch} branch based on ${ref}`);
  const relativeSourceDir = relative(
    gitClient.root,
    join(gitClient.root, source)
  );

  const destinationInSource = join(gitClient.root, relativeDestination);
  spinner.start(`Moving files and git history to ${destinationInSource}`);
  if (relativeSourceDir === '') {
    const files = await gitClient.getGitFiles('.');
    try {
      await rmAsync(destinationInSource, {
        recursive: true,
      });
    } catch {}
    await mkdirAsync(destinationInSource, { recursive: true });
    const gitignores = new Set<string>();
    for (const file of files) {
      if (basename(file) === '.gitignore') {
        gitignores.add(file);
        continue;
      }
      spinner.start(
        `Moving files and git history to ${destinationInSource}: ${file}`
      );

      const newPath = join(destinationInSource, file);

      await mkdirAsync(dirname(newPath), { recursive: true });
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

    for (const gitignore of gitignores) {
      await gitClient.move(gitignore, join(destinationInSource, gitignore));
    }
    await gitClient.amendCommit();
    for (const gitignore of gitignores) {
      await copyFileAsync(
        join(destinationInSource, gitignore),
        join(gitClient.root, gitignore)
      );
    }
  } else {
    let needsSquash = false;
    const needsMove = destinationInSource !== join(gitClient.root, source);
    if (needsMove) {
      try {
        await rmAsync(destinationInSource, {
          recursive: true,
        });
        await gitClient.commit('chore(repo): prepare for import');
        needsSquash = true;
      } catch {}

      await mkdirAsync(destinationInSource, { recursive: true });
    }

    const files = await gitClient.getGitFiles('.');
    for (const file of files) {
      if (file === '.gitignore') {
        continue;
      }
      spinner.start(
        `Moving files and git history to ${destinationInSource}: ${file}`
      );

      if (!relative(source, file).startsWith('..')) {
        if (needsMove) {
          const newPath = join(destinationInSource, file);

          await mkdirAsync(dirname(newPath), { recursive: true });
          try {
            await gitClient.move(file, newPath);
          } catch {
            await wait(100);
            await gitClient.move(file, newPath);
          }
        }
      } else {
        await rmAsync(join(gitClient.root, file), {
          recursive: true,
        });
      }
    }
    await gitClient.commit('chore(repo): prepare for import 2');
    if (needsSquash) {
      await gitClient.squashLastTwoCommits();
    }
  }
  spinner.succeed(
    `${sourceRemoteUrl} has been prepared to be imported into this workspace on a temporary branch: ${tempImportBranch} in ${gitClient.root}`
  );
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
