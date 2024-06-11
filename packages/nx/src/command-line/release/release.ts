import { prompt } from 'enquirer';
import { removeSync } from 'fs-extra';
import { readNxJson } from '../../config/nx-json';
import { createProjectFileMapUsingProjectGraph } from '../../project-graph/file-map-utils';
import { createProjectGraphAsync } from '../../project-graph/project-graph';
import { output } from '../../utils/output';
import { handleErrors } from '../../utils/params';
import { releaseChangelog, shouldCreateGitHubRelease } from './changelog';
import { ReleaseOptions, VersionOptions } from './command-object';
import {
  IMPLICIT_DEFAULT_RELEASE_GROUP,
  createNxReleaseConfig,
  handleNxReleaseConfigError,
} from './config/config';
import { filterReleaseGroups } from './config/filter-release-groups';
import {
  readRawVersionPlans,
  setVersionPlansOnGroups,
} from './config/version-plans';
import { releasePublish } from './publish';
import { getCommitHash, gitAdd, gitCommit, gitPush, gitTag } from './utils/git';
import { createOrUpdateGithubRelease } from './utils/github';
import { resolveNxJsonConfigErrorMessage } from './utils/resolve-nx-json-error-message';
import {
  createCommitMessageValues,
  createGitTagValues,
  handleDuplicateGitTags,
} from './utils/shared';
import { NxReleaseVersionResult, releaseVersion } from './version';

export const releaseCLIHandler = (args: VersionOptions) =>
  handleErrors(args.verbose, () => release(args));

export async function release(
  args: ReleaseOptions
): Promise<NxReleaseVersionResult | number> {
  const projectGraph = await createProjectGraphAsync({ exitOnError: true });
  const nxJson = readNxJson();

  if (args.verbose) {
    process.env.NX_VERBOSE_LOGGING = 'true';
  }

  const hasVersionGitConfig =
    Object.keys(nxJson.release?.version?.git ?? {}).length > 0;
  const hasChangelogGitConfig =
    Object.keys(nxJson.release?.changelog?.git ?? {}).length > 0;
  if (hasVersionGitConfig || hasChangelogGitConfig) {
    const jsonConfigErrorPath = hasVersionGitConfig
      ? ['release', 'version', 'git']
      : ['release', 'changelog', 'git'];
    const nxJsonMessage = await resolveNxJsonConfigErrorMessage(
      jsonConfigErrorPath
    );
    output.error({
      title: `The "release" top level command cannot be used with granular git configuration. Instead, configure git options in the "release.git" property in nx.json, or use the version, changelog, and publish subcommands or programmatic API directly.`,
      bodyLines: [nxJsonMessage],
    });
    process.exit(1);
  }

  // Apply default configuration to any optional user configuration
  const { error: configError, nxReleaseConfig } = await createNxReleaseConfig(
    projectGraph,
    await createProjectFileMapUsingProjectGraph(projectGraph),
    nxJson.release
  );
  if (configError) {
    return await handleNxReleaseConfigError(configError);
  }

  // These properties must never be undefined as this command should
  // always explicitly override the git operations of the subcommands.
  const shouldCommit = nxJson.release?.git?.commit ?? true;
  const shouldStage =
    (shouldCommit || nxJson.release?.git?.stageChanges) ?? false;
  const shouldTag = nxJson.release?.git?.tag ?? true;

  const versionResult: NxReleaseVersionResult = await releaseVersion({
    ...args,
    stageChanges: shouldStage,
    gitCommit: false,
    gitTag: false,
    deleteVersionPlans: false,
  });

  const changelogResult = await releaseChangelog({
    ...args,
    versionData: versionResult.projectsVersionData,
    version: versionResult.workspaceVersion,
    stageChanges: shouldStage,
    gitCommit: false,
    gitTag: false,
    createRelease: false,
    deleteVersionPlans: false,
  });

  const {
    error: filterError,
    releaseGroups,
    releaseGroupToFilteredProjects,
  } = filterReleaseGroups(
    projectGraph,
    nxReleaseConfig,
    args.projects,
    args.groups
  );
  if (filterError) {
    output.error(filterError);
    process.exit(1);
  }
  const rawVersionPlans = await readRawVersionPlans();
  setVersionPlansOnGroups(
    rawVersionPlans,
    releaseGroups,
    Object.keys(projectGraph.nodes)
  );

  const planFiles = new Set<string>();
  releaseGroups.forEach((group) => {
    if (group.versionPlans) {
      if (group.name === IMPLICIT_DEFAULT_RELEASE_GROUP) {
        output.logSingleLine(`Removing version plan files`);
      } else {
        output.logSingleLine(
          `Removing version plan files for group ${group.name}`
        );
      }
      group.versionPlans.forEach((plan) => {
        if (!args.dryRun) {
          removeSync(plan.absolutePath);
          if (args.verbose) {
            console.log(`Removing ${plan.relativePath}`);
          }
        } else {
          if (args.verbose) {
            console.log(
              `Would remove ${plan.relativePath}, but --dry-run was set`
            );
          }
        }
        planFiles.add(plan.relativePath);
      });
    }
  });
  const deletedFiles = Array.from(planFiles);
  if (deletedFiles.length > 0) {
    await gitAdd({
      changedFiles: [],
      deletedFiles,
      dryRun: args.dryRun,
      verbose: args.verbose,
    });
  }

  if (shouldCommit) {
    output.logSingleLine(`Committing changes with git`);

    const commitMessage: string | undefined = nxReleaseConfig.git.commitMessage;

    const commitMessageValues: string[] = createCommitMessageValues(
      releaseGroups,
      releaseGroupToFilteredProjects,
      versionResult.projectsVersionData,
      commitMessage
    );

    await gitCommit({
      messages: commitMessageValues,
      additionalArgs: nxReleaseConfig.git.commitArgs,
      dryRun: args.dryRun,
      verbose: args.verbose,
    });
  }

  if (shouldTag) {
    output.logSingleLine(`Tagging commit with git`);

    // Resolve any git tags as early as possible so that we can hard error in case of any duplicates before reaching the actual git command
    const gitTagValues: string[] = createGitTagValues(
      releaseGroups,
      releaseGroupToFilteredProjects,
      versionResult.projectsVersionData
    );
    handleDuplicateGitTags(gitTagValues);

    for (const tag of gitTagValues) {
      await gitTag({
        tag,
        message: nxReleaseConfig.git.tagMessage,
        additionalArgs: nxReleaseConfig.git.tagArgs,
        dryRun: args.dryRun,
        verbose: args.verbose,
      });
    }
  }

  const shouldCreateWorkspaceRelease = shouldCreateGitHubRelease(
    nxReleaseConfig.changelog.workspaceChangelog
  );

  let hasPushedChanges = false;
  let latestCommit: string | undefined;

  if (shouldCreateWorkspaceRelease && changelogResult.workspaceChangelog) {
    output.logSingleLine(`Pushing to git remote`);

    // Before we can create/update the release we need to ensure the commit exists on the remote
    await gitPush({
      dryRun: args.dryRun,
      verbose: args.verbose,
    });

    hasPushedChanges = true;

    output.logSingleLine(`Creating GitHub Release`);

    latestCommit = await getCommitHash('HEAD');
    await createOrUpdateGithubRelease(
      changelogResult.workspaceChangelog.releaseVersion,
      changelogResult.workspaceChangelog.contents,
      latestCommit,
      { dryRun: args.dryRun }
    );
  }

  for (const releaseGroup of releaseGroups) {
    const shouldCreateProjectReleases = shouldCreateGitHubRelease(
      releaseGroup.changelog
    );

    if (shouldCreateProjectReleases && changelogResult.projectChangelogs) {
      const projects = args.projects?.length
        ? // If the user has passed a list of projects, we need to use the filtered list of projects within the release group
          Array.from(releaseGroupToFilteredProjects.get(releaseGroup))
        : // Otherwise, we use the full list of projects within the release group
          releaseGroup.projects;
      const projectNodes = projects.map((name) => projectGraph.nodes[name]);

      for (const project of projectNodes) {
        const changelog = changelogResult.projectChangelogs[project.name];
        if (!changelog) {
          continue;
        }

        if (!hasPushedChanges) {
          output.logSingleLine(`Pushing to git remote`);

          // Before we can create/update the release we need to ensure the commit exists on the remote
          await gitPush({
            dryRun: args.dryRun,
            verbose: args.verbose,
          });

          hasPushedChanges = true;
        }

        output.logSingleLine(`Creating GitHub Release`);

        if (!latestCommit) {
          latestCommit = await getCommitHash('HEAD');
        }

        await createOrUpdateGithubRelease(
          changelog.releaseVersion,
          changelog.contents,
          latestCommit,
          { dryRun: args.dryRun }
        );
      }
    }
  }

  let hasNewVersion = false;
  // null means that all projects are versioned together but there were no changes
  if (versionResult.workspaceVersion !== null) {
    hasNewVersion = Object.values(versionResult.projectsVersionData).some(
      (version) => version.newVersion !== null
    );
  }

  let shouldPublish = !!args.yes && !args.skipPublish && hasNewVersion;
  const shouldPromptPublishing =
    !args.yes && !args.skipPublish && !args.dryRun && hasNewVersion;

  if (shouldPromptPublishing) {
    shouldPublish = await promptForPublish();
  }

  if (shouldPublish) {
    await releasePublish(args);
  } else {
    output.logSingleLine('Skipped publishing packages.');
  }

  return versionResult;
}

async function promptForPublish(): Promise<boolean> {
  try {
    const reply = await prompt<{ confirmation: boolean }>([
      {
        name: 'confirmation',
        message: 'Do you want to publish these versions?',
        type: 'confirm',
      },
    ]);
    return reply.confirmation;
  } catch (e) {
    // Handle the case where the user exits the prompt with ctrl+c
    return false;
  }
}
