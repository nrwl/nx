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
import { releasePublish } from './publish';
import { resolveNxJsonConfigErrorMessage } from './utils/resolve-nx-json-error-message';
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

  // Apply default configuration to any optional user configuration
  const { error: configError, nxReleaseConfig } = await createNxReleaseConfig(
    projectGraph,
    nxJson.release,
    'nx-release-publish'
  );
  if (configError) {
    return await handleNxReleaseConfigError(configError);
  }

  if (
    nxReleaseConfig.version.git.commit ||
    nxReleaseConfig.version.git.tag ||
    nxReleaseConfig.changelog.git.commit ||
    nxReleaseConfig.changelog.git.tag
  ) {
    const jsonConfigErrorPath = nxReleaseConfig.version.git.commit
      ? ['release', 'version', 'git', 'commit']
      : nxReleaseConfig.version.git.tag
      ? ['release', 'version', 'git', 'tag']
      : nxReleaseConfig.changelog.git.commit
      ? ['release', 'changelog', 'git', 'commit']
      : ['release', 'changelog', 'git', 'tag'];
    const nxJsonMessage = await resolveNxJsonConfigErrorMessage(
      jsonConfigErrorPath
    );
    output.error({
      title: `The 'release' top level command cannot be used with granular git configuration. Instead, configure git options in the 'release.git' property in nx.json.`,
      bodyLines: [nxJsonMessage],
    });
    process.exit(1);
  }

  const versionResult: NxReleaseVersionResult = await releaseVersion({
    ...args,
    // if enabled, committing and tagging will be handled by the changelog
    // command, so we should only stage the changes in the version command
    stageChanges: args.gitCommit || nxReleaseConfig.git?.commit,
    gitCommit: false,
    gitTag: false,
  });

  await releaseChangelog({
    ...args,
    versionData: versionResult.projectsVersionData,
    version: versionResult.workspaceVersion,
    workspaceChangelog: versionResult.workspaceVersion !== undefined,
  });

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

  const reply = await prompt<{ confirmation: 'yes' | 'no' }>([
    {
      name: 'confirmation',
      message: 'Do you want to publish these versions?',
      type: 'select',
      choices: [
        {
          name: 'no',
          message: 'No',
        },
        {
          name: 'yes',
          message: 'Yes',
        },
      ],
    },
  ]);

  console.log('\n');

  return reply.confirmation === 'yes';
}
