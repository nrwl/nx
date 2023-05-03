import { CreateWorkspaceOptions } from './create-workspace-options';
import { output } from './utils/output';
import { setupNxCloud } from './utils/nx/nx-cloud';
import { createSandbox } from './create-sandbox';
import { createEmptyWorkspace } from './create-empty-workspace';
import { createPreset } from './create-preset';
import { setupCI } from './utils/ci/setup-ci';
import { initializeGitRepo } from './utils/git/git';
import { getThirdPartyPreset } from './utils/preset/get-third-party-preset';
import { mapErrorToBodyLines } from './utils/error-utils';

export async function createWorkspace<T extends CreateWorkspaceOptions>(
  preset: string,
  options: T
) {
  const {
    packageManager,
    name,
    nxCloud,
    ci = '',
    skipGit = false,
    defaultBase = 'main',
    commit,
    cliName,
  } = options;

  if (cliName) {
    output.setCliName(cliName ?? 'NX');
  }

  const tmpDir = await createSandbox(packageManager);

  // nx new requires preset currently. We should probably make it optional.
  const directory = await createEmptyWorkspace<T>(
    tmpDir,
    name,
    packageManager,
    { ...options, preset }
  );

  // If the preset is a third-party preset, we need to call createPreset to install it
  // For first-party presets, it will created by createEmptyWorkspace instead.
  // In createEmptyWorkspace, it will call `nx new` -> `@nx/workspace newGenerator` -> `@nx/workspace generatePreset`.
  const thirdPartyPreset = await getThirdPartyPreset(preset);
  if (thirdPartyPreset) {
    await createPreset(thirdPartyPreset, options, packageManager, directory);
  }

  let nxCloudInstallRes;
  if (nxCloud) {
    nxCloudInstallRes = await setupNxCloud(directory, packageManager);
  }
  if (ci) {
    await setupCI(
      directory,
      ci,
      packageManager,
      nxCloud && nxCloudInstallRes?.code === 0
    );
  }
  if (!skipGit && commit) {
    try {
      await initializeGitRepo(directory, { defaultBase, commit });
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

  return {
    nxCloudInfo: nxCloudInstallRes?.stdout,
    directory,
  };
}
