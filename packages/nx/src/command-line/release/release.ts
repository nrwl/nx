import { prompt } from 'enquirer';
import { readNxJson } from '../../config/nx-json';
import { output } from '../../devkit-exports';
import { createProjectGraphAsync } from '../../project-graph/project-graph';
import { handleErrors } from '../../utils/params';
import { releaseChangelog } from './changelog';
import { ReleaseOptions, VersionOptions } from './command-object';
import {
  createNxReleaseConfig,
  handleNxReleaseConfigError,
} from './config/config';
import { filterReleaseGroups } from './config/filter-release-groups';
import { releasePublish } from './publish';
import { gitCommit, gitTag } from './utils/git';
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
  });

  await releaseChangelog({
    ...args,
    versionData: versionResult.projectsVersionData,
    version: versionResult.workspaceVersion,
    stageChanges: shouldStage,
    gitCommit: false,
    gitTag: false,
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
