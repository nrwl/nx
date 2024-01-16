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
      title: `The 'release' top level command cannot be used with granular git configuration. Instead, configure git options in the 'release.git' property in nx.json.`,
      bodyLines: [nxJsonMessage],
    });
    process.exit(1);
  }

  // Apply default configuration to any optional user configuration
  const { error: configError, nxReleaseConfig } = await createNxReleaseConfig(
    projectGraph,
    nxJson.release,
    'nx-release-publish'
  );
  if (configError) {
    return await handleNxReleaseConfigError(configError);
  }

  // Since git.commit and git.tag default to true, we only need to
  // disable committing and tagging if they are explicitly set to false.
  const shouldCommit = nxJson.release?.git?.commit ?? true;
  const shouldTag = nxJson.release?.git?.tag ?? true;

  // We should stage the changes only if this command
  // will actually be committing the files, or if stageChanges is explicitly set.
  const stageChanges = shouldCommit || nxReleaseConfig.git?.stageChanges;

  const versionResult: NxReleaseVersionResult = await releaseVersion({
    ...args,
    stageChanges,
    gitCommit: false,
    gitTag: false,
  });

  await releaseChangelog({
    ...args,
    versionData: versionResult.projectsVersionData,
    version: versionResult.workspaceVersion,
    workspaceChangelog: versionResult.workspaceVersion !== undefined,
    stageChanges,
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

    const commitMessage: string | undefined =
      nxReleaseConfig.git?.commitMessage;

    const commitMessageValues: string[] = createCommitMessageValues(
      releaseGroups,
      releaseGroupToFilteredProjects,
      versionResult.projectsVersionData,
      commitMessage
    );

    await gitCommit({
      messages: commitMessageValues,
      additionalArgs: nxReleaseConfig.git?.commitArgs,
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
        message: nxReleaseConfig.git?.tagMessage,
        additionalArgs: nxReleaseConfig.git?.tagArgs,
        dryRun: args.dryRun,
        verbose: args.verbose,
      });
    }
  }

  let shouldPublish = !!args.yes && !args.skipPublish;
  const shouldPromptPublishing = !args.yes && !args.skipPublish && !args.dryRun;

  if (shouldPromptPublishing) {
    shouldPublish = await promptForPublish();
  }

  if (shouldPublish) {
    await releasePublish(args);
  } else {
    console.log('Skipped publishing packages.');
  }

  return versionResult;
}

async function promptForPublish(): Promise<boolean> {
  console.log('\n');

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
    console.log('\n');
    // Handle the case where the user exits the prompt with ctrl+c
    return false;
  }
}
