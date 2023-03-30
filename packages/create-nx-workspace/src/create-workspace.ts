import { CreateWorkspaceOptions } from './create-workspace-options';
import { output } from './utils/output';
import { printNxCloudSuccessMessage, setupNxCloud } from './utils/nx/nx-cloud';
import { createSandbox } from './create-sandbox';
import { createEmptyWorkspace } from './create-empty-workspace';
import { createPreset } from './create-preset';
import { showNxWarning } from './utils/nx/show-nx-warning';
import { setupCI } from './utils/ci/setup-ci';
import { messages, recordStat } from './utils/nx/ab-testing';
import { initializeGitRepo } from './utils/git/git';
import { nxVersion } from './utils/nx/nx-version';
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
  } = options;

  output.log({
    title: `Nx is creating your v${nxVersion} workspace.`,
    bodyLines: [
      'To make sure the command works reliably in all environments, and that the preset is applied correctly,',
      `Nx will run "${options.packageManager} install" several times. Please wait.`,
    ],
  });

  const tmpDir = await createSandbox(packageManager);

  const directory = await createEmptyWorkspace<T>(
    tmpDir,
    name,
    packageManager,
    options
  );

  // If the preset is a third-party preset, we need to call createPreset to install it
  // For first-party presets, it will created by createEmptyWorkspace instead.
  // In createEmptyWorkspace, it will call `nx new` -> `@nrwl/workspace newGenerator` -> `@nrwl/workspace generatePreset`.
  const thirdPartyPreset = await getThirdPartyPreset(preset);
  if (thirdPartyPreset) {
    await createPreset(thirdPartyPreset, options, packageManager, directory);
  }

  let nxCloudInstallRes;
  if (nxCloud) {
    nxCloudInstallRes = await setupNxCloud(name, packageManager);
  }
  if (ci) {
    await setupCI(
      name,
      ci,
      packageManager,
      nxCloud && nxCloudInstallRes?.code === 0
    );
  }
  if (!skipGit) {
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

  showNxWarning(name);

  if (nxCloud && nxCloudInstallRes?.code === 0) {
    printNxCloudSuccessMessage(nxCloudInstallRes.stdout);
  }

  await recordStat({
    nxVersion,
    command: 'create-nx-workspace',
    useCloud: nxCloud,
    meta: messages.codeOfSelectedPromptMessage('nxCloudCreation'),
  });
}
