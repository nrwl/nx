import { join } from 'path';
import { createEmptyWorkspace } from './create-empty-workspace';
import { createPreset } from './create-preset';
import { createSandbox } from './create-sandbox';
import { CreateWorkspaceOptions } from './create-workspace-options';
import { setupCI } from './utils/ci/setup-ci';
import { mapErrorToBodyLines } from './utils/error-utils';
import {
  initializeGitRepo,
  pushToGitHub,
  VcsPushStatus,
} from './utils/git/git';
import {
  connectToNxCloudForTemplate,
  createNxCloudOnboardingUrl,
  getNxCloudInfo,
  getSkippedNxCloudInfo,
  readNxCloudToken,
} from './utils/nx/nx-cloud';
import { output } from './utils/output';
import { getPackageNameFromThirdPartyPreset } from './utils/preset/get-third-party-preset';
import { Preset } from './utils/preset/preset';
import { cloneTemplate } from './utils/template/clone-template';
import { execAndWait } from './utils/child-process-utils';

// State for SIGINT handler - only set after workspace is fully installed
let workspaceDirectory: string | undefined;
let cloudConnectUrl: string | undefined;

export function getInterruptedWorkspaceState(): {
  directory: string | undefined;
  connectUrl: string | undefined;
} {
  return { directory: workspaceDirectory, connectUrl: cloudConnectUrl };
}

export async function createWorkspace<T extends CreateWorkspaceOptions>(
  preset: string,
  options: T,
  rawArgs?: T
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
    skipGitHubPush = false,
    verbose = false,
  } = options;

  if (cliName) {
    output.setCliName(cliName ?? 'NX');
  }

  let directory: string;

  if (options.template) {
    if (!options.template.startsWith('nrwl/'))
      throw new Error(
        `Invalid template. Only templates from the 'nrwl' GitHub org are supported.`
      );
    const templateUrl = `https://github.com/${options.template}`;
    const workingDir = process.cwd().replace(/\\/g, '/');
    directory = join(workingDir, name);

    const ora = require('ora');
    const workspaceSetupSpinner = ora(
      `Creating workspace from template`
    ).start();

    try {
      await cloneTemplate(templateUrl, name);

      // Install dependencies (template flow always uses npm)
      await execAndWait('npm install --silent --ignore-scripts', directory);

      // Mark workspace as ready for SIGINT handler
      workspaceDirectory = directory;

      workspaceSetupSpinner.succeed(
        `Successfully created the workspace: ${directory}`
      );
    } catch (e) {
      workspaceSetupSpinner.fail();
      throw e;
    }

    // Connect to Nx Cloud for template flow
    if (nxCloud !== 'skip') {
      await connectToNxCloudForTemplate(
        directory,
        'create-nx-workspace',
        useGitHub
      );
    }
  } else {
    // Preset flow - existing behavior
    const tmpDir = await createSandbox(packageManager);
    const workspaceGlobs = getWorkspaceGlobsFromPreset(preset);

    // nx new requires a preset currently. We should probably make it optional.
    directory = await createEmptyWorkspace<T>(tmpDir, name, packageManager, {
      ...options,
      preset,
      workspaceGlobs,
    });

    // Mark workspace as ready for SIGINT handler
    workspaceDirectory = directory;

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
  }

  const isTemplate = !!options.template;

  // Only generate CI for preset flow (not template)
  if (nxCloud !== 'skip' && !isTemplate && nxCloud !== 'yes') {
    await setupCI(directory, nxCloud, packageManager);
  }

  let pushedToVcs = VcsPushStatus.SkippedGit;

  if (!skipGit) {
    try {
      await initializeGitRepo(directory, { defaultBase, commit });

      // Push to GitHub if commit was made, GitHub push is not skipped, and:
      // - CI provider is GitHub (preset flow), OR
      // - Using template flow with Nx Cloud enabled (yes)
      if (
        commit &&
        !skipGitHubPush &&
        (nxCloud === 'github' || (isTemplate && nxCloud === 'yes'))
      ) {
        pushedToVcs = await pushToGitHub(directory, {
          skipGitHubPush,
          name,
          defaultBase,
          verbose,
        });
      }
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

  // Create onboarding URL AFTER git operations so getVcsRemoteInfo() can detect the repo
  let connectUrl: string | undefined;
  let nxCloudInfo: string | undefined;
  if (nxCloud !== 'skip') {
    const token = readNxCloudToken(directory) as string;

    connectUrl = await createNxCloudOnboardingUrl(
      nxCloud,
      token,
      directory,
      useGitHub
    );

    // Store for SIGINT handler
    cloudConnectUrl = connectUrl;

    nxCloudInfo = await getNxCloudInfo(
      connectUrl,
      pushedToVcs,
      options.completionMessageKey
    );
  } else if (isTemplate && nxCloud === 'skip') {
    // Show nx connect message when user skips cloud in template flow
    nxCloudInfo = getSkippedNxCloudInfo();
  }

  return {
    nxCloudInfo,
    directory,
    pushedToVcs,
  };
}

export function extractConnectUrl(text: string): string | null {
  const urlPattern = /(https:\/\/[^\s]+\/connect\/[^\s]+)/g;
  const match = text.match(urlPattern);
  return match ? match[0] : null;
}

function getWorkspaceGlobsFromPreset(preset: string): string[] {
  // Should match how apps are created in `packages/workspace/src/generators/preset/preset.ts`.
  switch (preset) {
    case Preset.AngularMonorepo:
    case Preset.Expo:
    case Preset.Express:
    case Preset.Nest:
    case Preset.NextJs:
    case Preset.NodeMonorepo:
    case Preset.Nuxt:
    case Preset.ReactNative:
    case Preset.ReactMonorepo:
    case Preset.VueMonorepo:
    case Preset.WebComponents:
      return ['apps/*'];
    default:
      return ['packages/*'];
  }
}
