import * as chalk from 'chalk';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import {
  NxReleaseConfiguration,
  NxReleaseVersionConfiguration,
  readNxJson,
} from '../../config/nx-json';
import { LARGE_BUFFER } from '../../executors/run-commands/run-commands.impl';
import { formatChangedFilesWithPrettierIfAvailable } from '../../generators/internal-utils/format-changed-files-with-prettier-if-available';
import { FsTree, Tree, flushChanges } from '../../generators/tree';
import { createProjectFileMapUsingProjectGraph } from '../../project-graph/file-map-utils';
import { createProjectGraphAsync } from '../../project-graph/project-graph';
import { handleErrors } from '../../utils/handle-errors';
import { output } from '../../utils/output';
import { joinPathFragments } from '../../utils/path';
import { workspaceRoot } from '../../utils/workspace-root';
import { VersionOptions } from './command-object';
import {
  createNxReleaseConfig,
  handleNxReleaseConfigError,
} from './config/config';
import { deepMergeJson } from './config/deep-merge-json';
import { ReleaseGroupWithName } from './config/filter-release-groups';
import {
  readRawVersionPlans,
  setResolvedVersionPlansOnGroups,
} from './config/version-plans';
import { gitAdd, gitPush, gitTag } from './utils/git';
import { printDiff } from './utils/print-changes';
import { printConfigAndExit } from './utils/print-config';
import { ReleaseGraph, createReleaseGraph } from './utils/release-graph';
import { resolveNxJsonConfigErrorMessage } from './utils/resolve-nx-json-error-message';
import {
  VersionData,
  commitChanges,
  createCommitMessageValues,
  createGitTagValues,
  handleDuplicateGitTags,
} from './utils/shared';
import { validateResolvedVersionPlansAgainstFilter } from './utils/version-plan-utils';
import { ReleaseGroupProcessor } from './version/release-group-processor';
import { SemverBumpType } from './version/version-actions';

export interface NxReleaseVersionResult {
  /**
   * In one specific (and very common) case, an overall workspace version is relevant, for example when there is
   * only a single release group in which all projects have a fixed relationship to each other. In this case, the
   * overall workspace version is the same as the version of the release group (and every project within it). This
   * version could be a `string`, or it could be `null` if using conventional commits and no changes were detected.
   *
   * In all other cases (independent versioning, multiple release groups etc), the overall workspace version is
   * not applicable and will be `undefined` here. If a user attempts to use this value later when it is `undefined`
   * (for example in the changelog command), we will throw an appropriate error.
   */
  workspaceVersion: (string | null) | undefined;
  projectsVersionData: VersionData;
  /**
   * The release graph that was built or reused during this operation.
   * This can be passed to subsequent operations (changelog, publish) to avoid recomputing.
   */
  releaseGraph: ReleaseGraph;
}

export const releaseVersionCLIHandler = (args: VersionOptions) =>
  handleErrors(args.verbose, () => createAPI({}, false)(args));

export function createAPI(
  overrideReleaseConfig: NxReleaseConfiguration,
  ignoreNxJsonConfig: boolean
) {
  /**
   * NOTE: This function is also exported for programmatic usage and forms part of the public API
   * of Nx. We intentionally do not wrap the implementation with handleErrors because users need
   * to have control over their own error handling when using the API.
   */
  return async function releaseVersion(
    args: VersionOptions
  ): Promise<NxReleaseVersionResult> {
    const projectGraph = await createProjectGraphAsync({ exitOnError: true });
    const overriddenConfig = overrideReleaseConfig ?? {};
    const userProvidedReleaseConfig = ignoreNxJsonConfig
      ? overriddenConfig
      : deepMergeJson(readNxJson().release ?? {}, overriddenConfig);

    // Apply default configuration to any optional user configuration
    const { error: configError, nxReleaseConfig } = await createNxReleaseConfig(
      projectGraph,
      await createProjectFileMapUsingProjectGraph(projectGraph),
      userProvidedReleaseConfig
    );
    if (configError) {
      return await handleNxReleaseConfigError(configError);
    }
    // --print-config exits directly as it is not designed to be combined with any other programmatic operations
    if (args.printConfig) {
      return printConfigAndExit({
        userProvidedReleaseConfig,
        nxReleaseConfig,
        isDebug: args.printConfig === 'debug',
      });
    }

    // The nx release top level command will always override these three git args. This is how we can tell
    // if the top level release command was used or if the user is using the changelog subcommand.
    // If the user explicitly overrides these args, then it doesn't matter if the top level config is set,
    // as all of the git options would be overridden anyway.
    if (
      (args.gitCommit === undefined ||
        args.gitTag === undefined ||
        args.stageChanges === undefined) &&
      userProvidedReleaseConfig.git
    ) {
      const nxJsonMessage = await resolveNxJsonConfigErrorMessage([
        'release',
        'git',
      ]);
      output.error({
        title: `The "release.git" property in nx.json may not be used with the "nx release version" subcommand or programmatic API. Instead, configure git options for subcommands directly with "release.version.git" and "release.changelog.git".`,
        bodyLines: [nxJsonMessage],
      });
      process.exit(1);
    }

    const tree = new FsTree(workspaceRoot, args.verbose);

    // Use pre-built release graph if provided, otherwise create a new one
    const releaseGraph: ReleaseGraph =
      args.releaseGraph ||
      (await createReleaseGraph({
        tree,
        projectGraph,
        nxReleaseConfig,
        filters: {
          projects: args.projects,
          groups: args.groups,
        },
        firstRelease: args.firstRelease,
        verbose: args.verbose,
        preid: args.preid,
        versionActionsOptionsOverrides: args.versionActionsOptionsOverrides,
      }));

    // Display filter log if filters were applied
    if (
      releaseGraph.filterLog &&
      process.env.NX_RELEASE_INTERNAL_SUPPRESS_FILTER_LOG !== 'true'
    ) {
      output.note(releaseGraph.filterLog);
    }

    if (!args.specifier) {
      const rawVersionPlans = await readRawVersionPlans();
      await setResolvedVersionPlansOnGroups(
        rawVersionPlans,
        releaseGraph.releaseGroups,
        Object.keys(projectGraph.nodes),
        args.verbose
      );

      // Validate version plans against the filter after resolution
      const versionPlanValidationError =
        validateResolvedVersionPlansAgainstFilter(
          releaseGraph.releaseGroups,
          releaseGraph.releaseGroupToFilteredProjects
        );
      if (versionPlanValidationError) {
        output.error(versionPlanValidationError);
        process.exit(1);
      }
    } else {
      if (
        args.verbose &&
        releaseGraph.releaseGroups.some((g) => !!g.versionPlans)
      ) {
        console.log(
          `Skipping version plan discovery as a specifier was provided`
        );
      }
    }

    if (args.deleteVersionPlans === undefined) {
      // default to not delete version plans after versioning as they may be needed for changelog generation
      args.deleteVersionPlans = false;
    }

    /**
     * Run any configured top level pre-version command
     */
    runPreVersionCommand(nxReleaseConfig.version?.preVersionCommand, {
      dryRun: args.dryRun,
      verbose: args.verbose,
    });

    /**
     * Run any configured pre-version command for the selected release groups
     * in topological order
     */
    for (const groupName of releaseGraph.sortedReleaseGroups) {
      const releaseGroup = releaseGraph.releaseGroups.find(
        (g) => g.name === groupName
      );
      if (!releaseGroup) {
        // Release group was filtered out, skip
        continue;
      }
      runPreVersionCommand(
        releaseGroup.version?.groupPreVersionCommand,
        {
          dryRun: args.dryRun,
          verbose: args.verbose,
        },
        releaseGroup
      );
    }

    /**
     * Validate the resolved data for the release graph, e.g. that manifest files exist for all projects that will be processed.
     * This happens after preVersionCommands run, as those commands may create manifest files needed for versioning.
     */
    await releaseGraph.validate(tree);

    const commitMessage: string | undefined =
      args.gitCommitMessage || nxReleaseConfig.version.git.commitMessage;

    /**
     * additionalChangedFiles are files which need to be updated as a side-effect of versioning (such as package manager lock files),
     * and need to get staged and committed as part of the existing commit, if applicable.
     */
    const additionalChangedFiles = new Set<string>();
    const additionalDeletedFiles = new Set<string>();

    const processor = new ReleaseGroupProcessor(
      tree,
      projectGraph,
      nxReleaseConfig,
      releaseGraph,
      {
        dryRun: args.dryRun,
        verbose: args.verbose,
        firstRelease: args.firstRelease,
        preid: args.preid ?? '',
        userGivenSpecifier: args.specifier as SemverBumpType | undefined,
        filters: {
          projects: args.projects,
          groups: args.groups,
        },
        versionActionsOptionsOverrides: args.versionActionsOptionsOverrides,
      }
    );

    try {
      await processor.processGroups();

      // Delete processed version plan files if applicable
      if (args.deleteVersionPlans) {
        processor.deleteProcessedVersionPlanFiles();
      }
    } catch (err: any) {
      // Flush any pending project logs before printing the error to make troubleshooting easier
      processor.flushAllProjectLoggers();
      // Bubble up the error so that the CLI can print the error and exit, or the programmatic API can handle it
      throw err;
    }

    /**
     * Ensure that formatting is applied so that version bump diffs are as minimal as possible
     * within the context of the user's workspace.
     */
    await formatChangedFilesWithPrettierIfAvailable(tree, { silent: true });

    printAndFlushChanges(tree, !!args.dryRun);

    const { changedFiles: changed, deletedFiles: deleted } =
      await processor.afterAllProjectsVersioned({
        ...(nxReleaseConfig.version as NxReleaseVersionConfiguration)
          .versionActionsOptions,
        ...(args.versionActionsOptionsOverrides ?? {}),
      });
    changed.forEach((f) => additionalChangedFiles.add(f));
    deleted.forEach((f) => additionalDeletedFiles.add(f));

    // After all version actions have run, process docker projects as a layer above
    if (nxReleaseConfig.docker?.preVersionCommand) {
      /**
       * Run any configured top level docker pre-version command
       */
      runPreVersionCommand(
        nxReleaseConfig.docker.preVersionCommand,
        {
          dryRun: args.dryRun,
          verbose: args.verbose,
        },
        undefined,
        true
      );
    }

    /**
     * Run any configured docker pre-version command for the selected release groups
     * in topological order (dependencies before dependents)
     */
    for (const groupName of releaseGraph.sortedReleaseGroups) {
      const releaseGroup = releaseGraph.releaseGroups.find(
        (g) => g.name === groupName
      );
      if (!releaseGroup) {
        // Release group was filtered out, skip
        continue;
      }
      if (releaseGroup.docker?.groupPreVersionCommand) {
        runPreVersionCommand(
          releaseGroup.docker.groupPreVersionCommand,
          {
            dryRun: args.dryRun,
            verbose: args.verbose,
          },
          releaseGroup,
          true
        );
      }
    }

    // TODO(colum): Remove when Docker support is no longer experimental
    if (
      nxReleaseConfig.docker ||
      releaseGraph.releaseGroups.some((rg) => rg.docker)
    ) {
      output.warn({
        title: 'Warning',
        bodyLines: [
          `Docker support is experimental. Breaking changes may occur and not adhere to semver versioning.`,
        ],
      });
    }
    await processor.processDockerProjects(
      args.dockerVersionScheme,
      args.dockerVersion
    );

    const versionData = processor.getVersionData();

    // Resolve any git tags as early as possible so that we can hard error in case of any duplicates before reaching the actual git command
    const gitTagValues: string[] =
      (args.gitTag ?? nxReleaseConfig.version.git.tag)
        ? createGitTagValues(
            releaseGraph.releaseGroups,
            releaseGraph.releaseGroupToFilteredProjects,
            versionData
          )
        : [];
    handleDuplicateGitTags(gitTagValues);

    // Only applicable when there is a single release group with a fixed relationship
    let workspaceVersion: string | null | undefined = undefined;
    if (releaseGraph.releaseGroups.length === 1) {
      const releaseGroup = releaseGraph.releaseGroups[0];
      if (releaseGroup.projectsRelationship === 'fixed') {
        const releaseGroupProjectNames = Array.from(
          releaseGraph.releaseGroupToFilteredProjects.get(releaseGroup)
        );
        workspaceVersion = versionData[releaseGroupProjectNames[0]].newVersion; // all projects have the same version so we can just grab the first
      }
    }

    const changedFiles = [
      ...tree.listChanges().map((f) => f.path),
      ...additionalChangedFiles,
    ];
    const deletedFiles = Array.from(additionalDeletedFiles);

    // No further actions are necessary in this scenario (e.g. if conventional commits detected no changes)
    if (!changedFiles.length && !deletedFiles.length) {
      return {
        workspaceVersion,
        projectsVersionData: versionData,
        releaseGraph,
      };
    }

    if (args.gitCommit ?? nxReleaseConfig.version.git.commit) {
      await commitChanges({
        changedFiles,
        deletedFiles,
        isDryRun: !!args.dryRun,
        isVerbose: !!args.verbose,
        gitCommitMessages: createCommitMessageValues(
          releaseGraph.releaseGroups,
          releaseGraph.releaseGroupToFilteredProjects,
          versionData,
          commitMessage
        ),
        gitCommitArgs:
          args.gitCommitArgs || nxReleaseConfig.version.git.commitArgs,
      });
    } else if (args.stageChanges ?? nxReleaseConfig.version.git.stageChanges) {
      output.logSingleLine(`Staging changed files with git`);
      await gitAdd({
        changedFiles,
        deletedFiles,
        dryRun: args.dryRun,
        verbose: args.verbose,
      });
    }

    if (args.gitTag ?? nxReleaseConfig.version.git.tag) {
      output.logSingleLine(`Tagging commit with git`);
      for (const tag of gitTagValues) {
        await gitTag({
          tag,
          message: args.gitTagMessage || nxReleaseConfig.version.git.tagMessage,
          additionalArgs:
            args.gitTagArgs || nxReleaseConfig.version.git.tagArgs,
          dryRun: args.dryRun,
          verbose: args.verbose,
        });
      }
    }

    if (args.gitPush ?? nxReleaseConfig.version.git.push) {
      output.logSingleLine(
        `Pushing to git remote "${args.gitRemote ?? 'origin'}"`
      );
      await gitPush({
        gitRemote: args.gitRemote,
        dryRun: args.dryRun,
        verbose: args.verbose,
        additionalArgs:
          args.gitPushArgs || nxReleaseConfig.version.git.pushArgs,
      });
    }

    return {
      workspaceVersion,
      projectsVersionData: versionData,
      releaseGraph,
    };
  };
}

function printAndFlushChanges(tree: Tree, isDryRun: boolean) {
  const changes = tree.listChanges();

  console.log('');

  if (changes.length > 0) {
    // Print the changes
    changes.forEach((f) => {
      if (f.type === 'CREATE') {
        console.error(
          `${chalk.green('CREATE')} ${f.path}${
            isDryRun ? chalk.keyword('orange')(' [dry-run]') : ''
          }`
        );
        printDiff('', f.content?.toString() || '');
      } else if (f.type === 'UPDATE') {
        console.error(
          `${chalk.white('UPDATE')} ${f.path}${
            isDryRun ? chalk.keyword('orange')(' [dry-run]') : ''
          }`
        );
        const currentContentsOnDisk = readFileSync(
          joinPathFragments(tree.root, f.path)
        ).toString();
        printDiff(currentContentsOnDisk, f.content?.toString() || '');
      } else if (f.type === 'DELETE' && !f.path.includes('.nx')) {
        throw new Error(
          'Unexpected DELETE change, please report this as an issue'
        );
      }
    });
  } else {
    let text = isDryRun ? ' would be ' : ' ';
    output.warn({
      title: `No files${text}changed as a result of running versioning`,
    });
  }

  if (!isDryRun) {
    flushChanges(workspaceRoot, changes);
  }
}

function runPreVersionCommand(
  preVersionCommand: string,
  { dryRun, verbose }: { dryRun: boolean; verbose: boolean },
  releaseGroup?: ReleaseGroupWithName,
  dockerPreVersionCommand: boolean = false
) {
  if (!preVersionCommand) {
    return;
  }

  output.logSingleLine(
    releaseGroup
      ? `Executing${
          dockerPreVersionCommand ? ` docker` : ` release group`
        } pre-version command for "${releaseGroup.name}"`
      : `Executing${
          dockerPreVersionCommand ? ` docker` : ``
        } pre-version command`
  );
  if (verbose) {
    console.log(`Executing the following pre-version command:`);
    console.log(preVersionCommand);
  }

  let env: Record<string, string> = {
    ...process.env,
  };
  if (dryRun) {
    env.NX_DRY_RUN = 'true';
  }

  const stdio = verbose ? 'inherit' : 'pipe';
  try {
    execSync(preVersionCommand, {
      encoding: 'utf-8',
      maxBuffer: LARGE_BUFFER,
      stdio,
      env,
      windowsHide: false,
    });
  } catch (e) {
    const title = verbose
      ? `The pre-version command failed. See the full output above.`
      : `The pre-version command failed. Retry with --verbose to see the full output of the pre-version command.`;
    output.error({
      title,
      bodyLines: [preVersionCommand, e],
    });
    process.exit(1);
  }
}
