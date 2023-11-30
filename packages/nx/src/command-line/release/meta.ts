import { readNxJson } from '../../config/nx-json';
import { createProjectGraphAsync } from '../../project-graph/project-graph';
import { releaseChangelogCLIHandler } from './changelog';
import { ChangelogOptions, VersionOptions } from './command-object';
import {
  NxReleaseConfig,
  createNxReleaseConfig,
  handleNxReleaseConfigError,
} from './config/config';
import { NxReleaseVersionResult, releaseVersionCLIHandler } from './version';

export async function releaseMeta(
  args: VersionOptions & ChangelogOptions
): Promise<NxReleaseVersionResult | number> {
  const nxReleaseConfig = await readNxReleaseConfig(args);

  const versionResult: NxReleaseVersionResult | 1 =
    await releaseVersionCLIHandler({
      ...args,
      // if enabled, committing and tagging will be handled by the changelog
      // command, so we should only stage the changes in the version command
      stageChanges: args.gitCommit || nxReleaseConfig.git?.commit,
      gitCommit: false,
      gitTag: false,
    });

  if (versionResult === 1) {
    return 1;
  }

  const changelogResult = await releaseChangelogCLIHandler({
    ...args,
    versionData: versionResult.projectsVersionData,
    version: versionResult.workspaceVersion,
    workspaceChangelog: versionResult.workspaceVersion !== undefined,
  });

  if (changelogResult === 1) {
    return 1;
  }

  return versionResult;
}

async function readNxReleaseConfig(
  args: VersionOptions & ChangelogOptions
): Promise<NxReleaseConfig> {
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

  return nxReleaseConfig;
}
