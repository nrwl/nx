import { join, relative } from 'path';
import { cloneFromUpstream, GitRepository } from '../../utils/git-utils';
import { mkdir, readdir, rm } from 'fs';
import { promisify } from 'util';
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

const rmAsync = promisify(rm);
const mkdirAsync = promisify(mkdir);
const readdirAsync = promisify(readdir);

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
            'What is the Remote URL of the repository you want to import?',
          required: true,
        },
      ])
    ).sourceRemoteUrl;
  }

  const sourceRepoPath = join(tempImportDirectory, 'repo');
  const spinner = createSpinner(
    `Cloning ${sourceRemoteUrl} into a temporary directory: ${sourceRepoPath}`
  ).start();
  try {
    await rmAsync(tempImportDirectory, { recursive: true });
  } catch {}
  await mkdirAsync(tempImportDirectory, { recursive: true });

  const sourceGitClient = await cloneFromUpstream(
    sourceRemoteUrl,
    sourceRepoPath
  );
  spinner.succeed(`Cloned into ${tempImportDirectory}`);

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
        },
      ])
    ).destination;
  }

  const absDestination = join(process.cwd(), destination);

  await assertDestinationEmpty(absDestination);

  const tempImportBranch = getTempImportBranch(ref);

  const packageManager = detectPackageManager(workspaceRoot);

  const originalPackageWorkspaces = await getPackagesInPackageManagerWorkspace(
    packageManager
  );
  const destinationGitClient = new GitRepository(process.cwd());

  const relativeDestination = relative(
    destinationGitClient.root,
    absDestination
  );
  if (process.env.NX_IMPORT_SKIP_SOURCE_PREPARATION !== 'true') {
    await prepareSourceRepo(
      sourceGitClient,
      ref,
      source,
      relativeDestination,
      tempImportBranch,
      sourceRemoteUrl
    );

    await createTemporaryRemote(
      destinationGitClient,
      join(sourceRepoPath, '.git'),
      importRemoteName
    );
  }

  await mergeRemoteSource(
    destinationGitClient,
    sourceRemoteUrl,
    tempImportBranch,
    destination,
    importRemoteName,
    ref
  );

  spinner.start('Cleaning up temporary files, branches, and remotes');
  await rmAsync(tempImportDirectory, { recursive: true });
  await destinationGitClient.deleteBranch(tempImportBranch);
  await destinationGitClient.deleteGitRemote(importRemoteName);
  spinner.succeed('Cleaned up temporary files, branches, and remotes');

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

async function assertDestinationEmpty(absDestination: string) {
  try {
    const files = await readdirAsync(absDestination);
    if (files.length > 0) {
      throw new Error(
        `Destination directory ${absDestination} is not empty. Please make sure it is empty before importing into it.`
      );
    }
  } catch {
    // Directory does not exist and that's OK
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
  await destinationGitClient.fetch(remoteName, {
    depth: 1,
  });
}
