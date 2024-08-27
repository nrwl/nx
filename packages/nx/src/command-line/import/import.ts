import { join, relative, resolve } from 'path';
import { cloneFromUpstream, GitRepository } from '../../utils/git-utils';
import { stat, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'tmp';
import { prompt } from 'enquirer';
import { output } from '../../utils/output';
import * as createSpinner from 'ora';
import { detectPlugins, installPlugins } from '../init/init-v2';
import { readNxJson } from '../../config/nx-json';
import { workspaceRoot } from '../../utils/workspace-root';
import {
  detectPackageManager,
  getPackageManagerCommand,
} from '../../utils/package-manager';
import { resetWorkspaceContext } from '../../utils/workspace-context';
import { runInstall } from '../init/implementation/utils';
import { getBaseRef } from '../../utils/command-line-utils';
import { prepareSourceRepo } from './utils/prepare-source-repo';
import { mergeRemoteSource } from './utils/merge-remote-source';
import {
  getPackagesInPackageManagerWorkspace,
  needsInstall,
} from './utils/needs-install';

const importRemoteName = '__tmp_nx_import__';

export interface ImportOptions {
  /**
   * The remote URL of the repository to import
   */
  sourceRemoteUrl: string;
  /**
   * The branch or reference to import
   */
  ref: string;
  /**
   * The directory in the source repo to import
   */
  source: string;
  /**
   * The directory in the destination repo to import into
   */
  destination: string;
  /**
   * The depth to clone the source repository (limit this for faster clone times)
   */
  depth: number;

  verbose: boolean;
  interactive: boolean;
}

export async function importHandler(options: ImportOptions) {
  let { sourceRemoteUrl, ref, source, destination } = options;

  output.log({
    title:
      'Nx will walk you through the process of importing code from another repository into this workspace:',
    bodyLines: [
      `1. Nx will clone the other repository into a temporary directory`,
      `2. Code to be imported will be moved to the same directory it will be imported into on a temporary branch`,
      `3. The code will be merged into the current branch in this workspace`,
      `4. Nx will recommend plugins to integrate tools used in the imported code with Nx`,
      `5. The code will be successfully imported into this workspace`,
      '',
      `Git history will be preserved during this process`,
    ],
  });

  const tempImportDirectory = join(tmpdir, 'nx-import');

  if (!sourceRemoteUrl) {
    sourceRemoteUrl = (
      await prompt<{ sourceRemoteUrl: string }>([
        {
          type: 'input',
          name: 'sourceRemoteUrl',
          message:
            'What is the URL of the repository you want to import? (This can be a local git repository or a git remote URL)',
          required: true,
        },
      ])
    ).sourceRemoteUrl;
  }

  try {
    const maybeLocalDirectory = await stat(sourceRemoteUrl);
    if (maybeLocalDirectory.isDirectory()) {
      sourceRemoteUrl = resolve(sourceRemoteUrl);
    }
  } catch (e) {
    // It's a remote url
  }

  const sourceRepoPath = join(tempImportDirectory, 'repo');
  const spinner = createSpinner(
    `Cloning ${sourceRemoteUrl} into a temporary directory: ${sourceRepoPath}`
  ).start();
  try {
    await rm(tempImportDirectory, { recursive: true });
  } catch {}
  await mkdir(tempImportDirectory, { recursive: true });

  let sourceGitClient: GitRepository;
  try {
    sourceGitClient = await cloneFromUpstream(sourceRemoteUrl, sourceRepoPath, {
      originName: importRemoteName,
      depth: options.depth,
    });
  } catch (e) {
    spinner.fail(`Failed to clone ${sourceRemoteUrl} into ${sourceRepoPath}`);
    let errorMessage = `Failed to clone ${sourceRemoteUrl} into ${sourceRepoPath}. Please double check the remote and try again.\n${e.message}`;

    throw new Error(errorMessage);
  }
  spinner.succeed(`Cloned into ${sourceRepoPath}`);

  if (!ref) {
    const branchChoices = await sourceGitClient.listBranches();
    ref = (
      await prompt<{ ref: string }>([
        {
          type: 'autocomplete',
          name: 'ref',
          message: `Which branch do you want to import?`,
          choices: branchChoices,
          /**
           * Limit the number of choices so that it fits on screen
           */
          limit: process.stdout.rows - 3,
          required: true,
        } as any,
      ])
    ).ref;
  }

  if (!source) {
    source = (
      await prompt<{ source: string }>([
        {
          type: 'input',
          name: 'source',
          message: `Which directory do you want to import into this workspace? (leave blank to import the entire repository)`,
        },
      ])
    ).source;
  }

  if (!destination) {
    destination = (
      await prompt<{ destination: string }>([
        {
          type: 'input',
          name: 'destination',
          message: 'Where in this workspace should the code be imported into?',
          required: true,
          initial: source ? source : undefined,
        },
      ])
    ).destination;
  }

  const absSource = join(sourceRepoPath, source);
  const absDestination = join(process.cwd(), destination);

  try {
    await stat(absSource);
  } catch (e) {
    throw new Error(
      `The source directory ${source} does not exist in ${sourceRemoteUrl}. Please double check to make sure it exists.`
    );
  }

  const destinationGitClient = new GitRepository(process.cwd());
  await assertDestinationEmpty(destinationGitClient, absDestination);

  const tempImportBranch = getTempImportBranch(ref);

  const packageManager = detectPackageManager(workspaceRoot);

  const originalPackageWorkspaces = await getPackagesInPackageManagerWorkspace(
    packageManager
  );

  const relativeDestination = relative(
    destinationGitClient.root,
    absDestination
  );
  await prepareSourceRepo(
    sourceGitClient,
    ref,
    source,
    relativeDestination,
    tempImportBranch,
    sourceRemoteUrl,
    importRemoteName
  );

  await createTemporaryRemote(
    destinationGitClient,
    join(sourceRepoPath, '.git'),
    importRemoteName
  );

  await mergeRemoteSource(
    destinationGitClient,
    sourceRemoteUrl,
    tempImportBranch,
    destination,
    importRemoteName,
    ref
  );

  spinner.start('Cleaning up temporary files and remotes');
  await rm(tempImportDirectory, { recursive: true });
  await destinationGitClient.deleteGitRemote(importRemoteName);
  spinner.succeed('Cleaned up temporary files and remotes');

  const pmc = getPackageManagerCommand();
  const nxJson = readNxJson(workspaceRoot);

  resetWorkspaceContext();

  const { plugins, updatePackageScripts } = await detectPlugins(
    nxJson,
    options.interactive
  );

  if (plugins.length > 0) {
    output.log({ title: 'Installing Plugins' });
    installPlugins(workspaceRoot, plugins, pmc, updatePackageScripts);

    await destinationGitClient.amendCommit();
  } else if (await needsInstall(packageManager, originalPackageWorkspaces)) {
    output.log({
      title: 'Installing dependencies for imported code',
    });

    runInstall(workspaceRoot, getPackageManagerCommand(packageManager));

    await destinationGitClient.amendCommit();
  }

  console.log(await destinationGitClient.showStat());

  output.log({
    title: `Merging these changes into ${getBaseRef(nxJson)}`,
    bodyLines: [
      `MERGE these changes when merging these changes.`,
      `Do NOT squash and do NOT rebase these changes when merging these changes.`,
      `If you would like to UNDO these changes, run "git reset HEAD~1 --hard"`,
    ],
  });
}

async function assertDestinationEmpty(
  gitClient: GitRepository,
  absDestination: string
) {
  const files = await gitClient.getGitFiles(absDestination);
  if (files.length > 0) {
    throw new Error(
      `Destination directory ${absDestination} is not empty. Please make sure it is empty before importing into it.`
    );
  }
}

function getTempImportBranch(sourceBranch: string) {
  return `__nx_tmp_import__/${sourceBranch}`;
}

async function createTemporaryRemote(
  destinationGitClient: GitRepository,
  sourceRemoteUrl: string,
  remoteName: string
) {
  try {
    await destinationGitClient.deleteGitRemote(remoteName);
  } catch {}
  await destinationGitClient.addGitRemote(remoteName, sourceRemoteUrl);
  await destinationGitClient.fetch(remoteName);
}
