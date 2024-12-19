import { isAbsolute, join, relative, resolve } from 'path';
import { existsSync, promises as fsp } from 'node:fs';
import * as chalk from 'chalk';
import { cloneFromUpstream, GitRepository } from '../../utils/git-utils';
import { stat, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'tmp';
import { prompt } from 'enquirer';
import { output } from '../../utils/output';
import * as createSpinner from 'ora';
import { detectPlugins } from '../init/init-v2';
import { readNxJson } from '../../config/nx-json';
import { workspaceRoot } from '../../utils/workspace-root';
import {
  addPackagePathToWorkspaces,
  detectPackageManager,
  getPackageManagerCommand,
  getPackageWorkspaces,
  isWorkspacesEnabled,
  PackageManager,
  PackageManagerCommands,
} from '../../utils/package-manager';
import { resetWorkspaceContext } from '../../utils/workspace-context';
import { runInstall } from '../init/implementation/utils';
import { getBaseRef } from '../../utils/command-line-utils';
import { prepareSourceRepo } from './utils/prepare-source-repo';
import { mergeRemoteSource } from './utils/merge-remote-source';
import { minimatch } from 'minimatch';
import {
  configurePlugins,
  runPackageManagerInstallPlugins,
} from '../init/configure-plugins';
import {
  checkCompatibleWithPlugins,
  updatePluginsInNxJson,
} from '../init/implementation/check-compatible-with-plugins';

const importRemoteName = '__tmp_nx_import__';

export interface ImportOptions {
  /**
   * The remote URL of the repository to import
   */
  sourceRepository: string;
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
  process.env.NX_RUNNING_NX_IMPORT = 'true';
  let { sourceRepository, ref, source, destination, verbose } = options;
  const destinationGitClient = new GitRepository(process.cwd());

  if (await destinationGitClient.hasUncommittedChanges()) {
    throw new Error(
      `You have uncommitted changes in the destination repository. Commit or revert the changes and try again.`
    );
  }

  output.log({
    title:
      'Nx will walk you through the process of importing code from the source repository into this repository:',
    bodyLines: [
      `1. Nx will clone the source repository into a temporary directory`,
      `2. The project code from the sourceDirectory will be moved to the destinationDirectory on a temporary branch in this repository`,
      `3. The temporary branch will be merged into the current branch in this repository`,
      `4. Nx will recommend plugins to integrate any new tools used in the imported code`,
      '',
      `Git history will be preserved during this process as long as you MERGE these changes. Do NOT squash and do NOT rebase the changes when merging branches.  If you would like to UNDO these changes, run "git reset HEAD~1 --hard"`,
    ],
  });

  const tempImportDirectory = join(tmpdir, 'nx-import');

  if (!sourceRepository) {
    sourceRepository = (
      await prompt<{ sourceRepository: string }>([
        {
          type: 'input',
          name: 'sourceRepository',
          message:
            'What is the URL of the repository you want to import? (This can be a local git repository or a git remote URL)',
          required: true,
        },
      ])
    ).sourceRepository;
  }

  try {
    const maybeLocalDirectory = await stat(sourceRepository);
    if (maybeLocalDirectory.isDirectory()) {
      sourceRepository = resolve(sourceRepository);
    }
  } catch (e) {
    // It's a remote url
  }

  const sourceTempRepoPath = join(tempImportDirectory, 'repo');
  const spinner = createSpinner(
    `Cloning ${sourceRepository} into a temporary directory: ${sourceTempRepoPath} (Use --depth to limit commit history and speed up clone times)`
  ).start();
  try {
    await rm(tempImportDirectory, { recursive: true });
  } catch {}
  await mkdir(tempImportDirectory, { recursive: true });

  let sourceGitClient: GitRepository;
  try {
    sourceGitClient = await cloneFromUpstream(
      sourceRepository,
      sourceTempRepoPath,
      {
        originName: importRemoteName,
        depth: options.depth,
      }
    );
  } catch (e) {
    spinner.fail(
      `Failed to clone ${sourceRepository} into ${sourceTempRepoPath}`
    );
    let errorMessage = `Failed to clone ${sourceRepository} into ${sourceTempRepoPath}. Please double check the remote and try again.\n${e.message}`;

    throw new Error(errorMessage);
  }
  spinner.succeed(`Cloned into ${sourceTempRepoPath}`);

  // Detecting the package manager before preparing the source repo for import.
  const sourcePackageManager = detectPackageManager(sourceGitClient.root);

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

  const absSource = join(sourceTempRepoPath, source);

  if (isAbsolute(destination)) {
    throw new Error(
      `The destination directory must be a relative path in this repository.`
    );
  }

  const absDestination = join(process.cwd(), destination);

  await assertDestinationEmpty(destinationGitClient, absDestination);

  const tempImportBranch = getTempImportBranch(ref);
  await sourceGitClient.addFetchRemote(importRemoteName, ref);
  await sourceGitClient.fetch(importRemoteName, ref);
  spinner.succeed(`Fetched ${ref} from ${sourceRepository}`);
  spinner.start(
    `Checking out a temporary branch, ${tempImportBranch} based on ${ref}`
  );
  await sourceGitClient.checkout(tempImportBranch, {
    new: true,
    base: `${importRemoteName}/${ref}`,
  });

  spinner.succeed(`Created a ${tempImportBranch} branch based on ${ref}`);

  try {
    await stat(absSource);
  } catch (e) {
    throw new Error(
      `The source directory ${source} does not exist in ${sourceRepository}. Please double check to make sure it exists.`
    );
  }

  const packageManager = detectPackageManager(workspaceRoot);
  const sourceIsNxWorkspace = existsSync(join(sourceGitClient.root, 'nx.json'));

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
    sourceRepository
  );

  await createTemporaryRemote(
    destinationGitClient,
    join(sourceTempRepoPath, '.git'),
    importRemoteName
  );

  await mergeRemoteSource(
    destinationGitClient,
    sourceRepository,
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
    options.interactive,
    true
  );

  if (packageManager !== sourcePackageManager) {
    output.warn({
      title: `Mismatched package managers`,
      bodyLines: [
        `The source repository is using a different package manager (${sourcePackageManager}) than this workspace (${packageManager}).`,
        `This could lead to install issues due to discrepancies in "package.json" features.`,
      ],
    });
  }

  await handleMissingWorkspacesEntry(
    packageManager,
    pmc,
    relativeDestination,
    destinationGitClient
  );

  let installed = await runInstallDestinationRepo(
    packageManager,
    destinationGitClient
  );
  if (installed) {
    // Check compatibility with existing plugins for the workspace included new imported projects
    if (nxJson.plugins?.length > 0) {
      const incompatiblePlugins = await checkCompatibleWithPlugins(
        nxJson.plugins,
        workspaceRoot
      );
      if (Object.keys(incompatiblePlugins).length > 0) {
        updatePluginsInNxJson(workspaceRoot, incompatiblePlugins);
        await destinationGitClient.amendCommit();
      }
    }
    if (plugins.length > 0) {
      installed = await runPluginsInstall(plugins, pmc, destinationGitClient);
      if (installed) {
        const { succeededPlugins } = await configurePlugins(
          plugins,
          updatePackageScripts,
          pmc,
          workspaceRoot,
          verbose
        );
        if (succeededPlugins.length > 0) {
          await destinationGitClient.amendCommit();
        }
      }
    }
  }

  console.log(await destinationGitClient.showStat());

  if (installed === false) {
    const pmc = getPackageManagerCommand(packageManager);
    output.warn({
      title: `The import was successful, but the install failed`,
      bodyLines: [
        `You may need to run "${pmc.install}" manually to resolve the issue. The error is logged above.`,
      ],
    });
  }

  if (source != destination) {
    output.warn({
      title: `Check configuration files`,
      bodyLines: [
        `The source directory (${source}) and destination directory (${destination}) are different.`,
        `You may need to update configuration files to match the directory in this repository.`,
        sourceIsNxWorkspace
          ? `For example, path options in project.json such as "main", "tsConfig", and "outputPath" need to be updated.`
          : `For example, relative paths in tsconfig.json and other tooling configuration files may need to be updated.`,
      ],
    });
  }

  // When only a subdirectory is imported, there might be devDependencies in the root package.json file
  // that needs to be ported over as well.
  if (ref) {
    output.log({
      title: `Check root dependencies`,
      bodyLines: [
        `"dependencies" and "devDependencies" are not imported from the source repository (${sourceRepository}).`,
        `You may need to add some of those dependencies to this workspace in order to run tasks successfully.`,
      ],
    });
  }

  output.log({
    title: `Merging these changes into ${getBaseRef(nxJson)}`,
    bodyLines: [
      `MERGE these changes when merging these changes.`,
      `Do NOT squash these commits when merging these changes.`,
      `If you rebase, make sure to use "--rebase-merges" to preserve merge commits.`,
      `To UNDO these changes, run "git reset HEAD~1 --hard"`,
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

/**
 * Run install for the imported code and plugins
 * @returns true if the install failed
 */
async function runInstallDestinationRepo(
  packageManager: PackageManager,
  destinationGitClient: GitRepository
): Promise<boolean> {
  let installed = true;
  try {
    output.log({
      title: 'Installing dependencies for imported code',
    });
    runInstall(workspaceRoot, getPackageManagerCommand(packageManager));
    await destinationGitClient.amendCommit();
  } catch (e) {
    installed = false;
    output.error({
      title: `Install failed: ${e.message || 'Unknown error'}`,
      bodyLines: [e.stack],
    });
  }
  return installed;
}

async function runPluginsInstall(
  plugins: string[],
  pmc: PackageManagerCommands,
  destinationGitClient: GitRepository
) {
  let installed = true;
  output.log({ title: 'Installing Plugins' });
  try {
    runPackageManagerInstallPlugins(workspaceRoot, pmc, plugins);
    await destinationGitClient.amendCommit();
  } catch (e) {
    installed = false;
    output.error({
      title: `Install failed: ${e.message || 'Unknown error'}`,
      bodyLines: [
        'The following plugins were not installed:',
        ...plugins.map((p) => `- ${chalk.bold(p)}`),
        e.stack,
      ],
    });
    output.error({
      title: `To install the plugins manually`,
      bodyLines: [
        'You may need to run commands to install the plugins:',
        ...plugins.map((p) => `- ${chalk.bold(pmc.exec + ' nx add ' + p)}`),
      ],
    });
  }
  return installed;
}

/*
 * If the user imports a project that isn't in the workspaces entry, we should add that path to the workspaces entry.
 */
async function handleMissingWorkspacesEntry(
  pm: PackageManager,
  pmc: PackageManagerCommands,
  pkgPath: string,
  destinationGitClient: GitRepository
): Promise<void> {
  if (!isWorkspacesEnabled(pm, workspaceRoot)) {
    output.warn({
      title: `Missing workspaces in package.json`,
      bodyLines:
        pm === 'npm'
          ? [
              `We recommend enabling NPM workspaces to install dependencies for the imported project.`,
              `Add \`"workspaces": ["${pkgPath}"]\` to package.json and run "${pmc.install}".`,
              `See: https://docs.npmjs.com/cli/using-npm/workspaces`,
            ]
          : pm === 'yarn'
          ? [
              `We recommend enabling Yarn workspaces to install dependencies for the imported project.`,
              `Add \`"workspaces": ["${pkgPath}"]\` to package.json and run "${pmc.install}".`,
              `See: https://yarnpkg.com/features/workspaces`,
            ]
          : pm === 'bun'
          ? [
              `We recommend enabling Bun workspaces to install dependencies for the imported project.`,
              `Add \`"workspaces": ["${pkgPath}"]\` to package.json and run "${pmc.install}".`,
              `See: https://bun.sh/docs/install/workspaces`,
            ]
          : [
              `We recommend enabling PNPM workspaces to install dependencies for the imported project.`,
              `Add the following entry to to pnpm-workspace.yaml and run "${pmc.install}":`,
              chalk.bold(`packages:\n  - '${pkgPath}'`),
              `See: https://pnpm.io/workspaces`,
            ],
    });
  } else {
    let workspaces: string[] = getPackageWorkspaces(pm, workspaceRoot);
    const isPkgIncluded = workspaces.some((w) => minimatch(pkgPath, w));
    if (isPkgIncluded) {
      return;
    }

    addPackagePathToWorkspaces(pkgPath, pm, workspaces, workspaceRoot);
    await destinationGitClient.amendCommit();
    output.success({
      title: `Project added in workspaces`,
      bodyLines:
        pm === 'npm' || pm === 'yarn' || pm === 'bun'
          ? [
              `The imported project (${chalk.bold(
                pkgPath
              )}) is missing the "workspaces" field in package.json.`,
              `Added "${chalk.bold(pkgPath)}" to workspaces.`,
            ]
          : [
              `The imported project (${chalk.bold(
                pkgPath
              )}) is missing the "packages" field in pnpm-workspaces.yaml.`,
              `Added "${chalk.bold(pkgPath)}" to packages.`,
            ],
    });
  }
}
