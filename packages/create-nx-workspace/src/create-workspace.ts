import { CreateWorkspaceOptions } from './create-workspace-options';
import { output } from './utils/output';
import { setupNxCloud } from './utils/nx/nx-cloud';
import { createSandbox } from './create-sandbox';
import { createEmptyWorkspace } from './create-empty-workspace';
import { createPreset } from './create-preset';
import { setupCI } from './utils/ci/setup-ci';
import { commitChanges, initializeGitRepo } from './utils/git/git';
import { getPackageNameFromThirdPartyPreset } from './utils/preset/get-third-party-preset';
import { mapErrorToBodyLines } from './utils/error-utils';

export async function createWorkspace<T extends CreateWorkspaceOptions>(
  preset: string,
  options: T
) {
  const {
    packageManager,
    name,
    nxCloud,
    skipGit = false,
    defaultBase = 'main',
    commit,
    cliName,
    useGitHub,
  } = options;

  if (cliName) {
    output.setCliName(cliName ?? 'NX');
  }

  const tmpDir = await createSandbox(packageManager);

  // nx new requires a preset currently. We should probably make it optional.
  const directory = await createEmptyWorkspace<T>(
    tmpDir,
    name,
    packageManager,
    { ...options, preset }
  );

  // If the preset is a third-party preset, we need to call createPreset to install it
  // For first-party presets, it will be created by createEmptyWorkspace instead.
  // In createEmptyWorkspace, it will call `nx new` -> `@nx/workspace newGenerator` -> `@nx/workspace generatePreset`.
  const thirdPartyPackageName = getPackageNameFromThirdPartyPreset(preset);
  if (thirdPartyPackageName) {
    await createPreset(
      thirdPartyPackageName,
      options,
      packageManager,
      directory
    );
  }

  let gitSuccess = false;
  if (!skipGit && commit) {
    try {
      await initializeGitRepo(directory, { defaultBase, commit });
      gitSuccess = true;
    } catch (e) {
      if (e instanceof Error) {
        output.error({
          title: 'Could not initialize git repository',
          bodyLines: mapErrorToBodyLines(e),
        });
      } else {
        console.error(e);
      }
    }
  }

  let nxCloudInstallRes;
  if (nxCloud !== 'skip') {
    nxCloudInstallRes = await setupNxCloud(
      directory,
      packageManager,
      nxCloud,
      useGitHub
    );

    if (nxCloud !== 'yes') {
      const nxCIsetupRes = await setupCI(
        directory,
        nxCloud,
        packageManager,
        nxCloudInstallRes?.code === 0
      );
      if (nxCIsetupRes?.code === 0) {
        commitChanges(directory, `feat(nx): Generated CI workflow`);
      }
    }
  }

  return {
    nxCloudInfo: nxCloudInstallRes?.stdout,
    directory,
  };
}
