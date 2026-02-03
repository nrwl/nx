import { existsSync, unlinkSync } from 'node:fs';
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
import {
  addConnectUrlToReadme,
  amendOrCommitReadme,
} from './utils/template/update-readme';
import { execAndWait } from './utils/child-process-utils';
import {
  generatePackageManagerFiles,
  getPackageManagerCommand,
} from './utils/package-manager';

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

      // Remove npm lockfile from template since we'll generate the correct one
      const npmLockPath = join(directory, 'package-lock.json');
      if (existsSync(npmLockPath)) {
        unlinkSync(npmLockPath);
      }

      // Generate package manager specific files (e.g., .yarnrc.yml for Yarn Berry)
      generatePackageManagerFiles(directory, packageManager);

      // Install dependencies with the user's package manager
      const pmc = getPackageManagerCommand(packageManager);
      if (pmc.preInstall) {
        await execAndWait(pmc.preInstall, directory);
      }
      await execAndWait(pmc.install, directory);

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
    // For variant 1 (NXC-3628): Skip connection, use GitHub flow for URL generation
    if (nxCloud !== 'skip' && !options.skipCloudConnect) {
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

  // Generate CI for preset flow (not template)
  // When nxCloud === 'yes' (from simplified prompt), use GitHub as the CI provider
  if (nxCloud !== 'skip' && !isTemplate) {
    const ciProvider = nxCloud === 'yes' ? 'github' : nxCloud;
    await setupCI(directory, ciProvider, packageManager);
  }

  let pushedToVcs = VcsPushStatus.SkippedGit;

  if (!skipGit) {
    try {
      await initializeGitRepo(directory, { defaultBase, commit });

      // Push to GitHub if commit was made, GitHub push is not skipped, and:
      // - CI provider is GitHub (preset flow with CLI arg), OR
      // - Nx Cloud enabled via simplified prompt (nxCloud === 'yes')
      if (
        commit &&
        !skipGitHubPush &&
        (nxCloud === 'github' || nxCloud === 'yes')
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
    // For variant 1 (skipCloudConnect=true): Skip readNxCloudToken() entirely
    // - We didn't call connectToNxCloudForTemplate(), so no token exists
    // - The spinner message "Checking Nx Cloud setup" would be misleading
    // - createNxCloudOnboardingUrl() uses GitHub flow which sends accessToken: null
    //
    // For variant 0: Read the token as before (cloud was connected)
    const token = options.skipCloudConnect
      ? undefined
      : readNxCloudToken(directory);

    connectUrl = await createNxCloudOnboardingUrl(
      nxCloud,
      token,
      directory,
      useGitHub
    );

    // Store for SIGINT handler
    cloudConnectUrl = connectUrl;

    // Update README with connect URL (strips markers, adds connect section)
    // Then commit the change - amend if not pushed, new commit if already pushed
    if (isTemplate) {
      const readmeUpdated = addConnectUrlToReadme(directory, connectUrl);
      if (readmeUpdated && !skipGit && commit) {
        const alreadyPushed = pushedToVcs === VcsPushStatus.PushedToVcs;
        await amendOrCommitReadme(directory, alreadyPushed);
      }
    }

    nxCloudInfo = await getNxCloudInfo(
      connectUrl,
      pushedToVcs,
      options.completionMessageKey,
      name
    );
  } else if (isTemplate && nxCloud === 'skip') {
    // Strip marker comments from README even when cloud is skipped
    // so users don't see raw <!-- BEGIN/END: nx-cloud --> markers
    const readmeUpdated = addConnectUrlToReadme(directory, undefined);
    if (readmeUpdated && !skipGit && commit) {
      const alreadyPushed = pushedToVcs === VcsPushStatus.PushedToVcs;
      await amendOrCommitReadme(directory, alreadyPushed);
    }

    // Show nx connect message when user skips cloud in template flow
    nxCloudInfo = getSkippedNxCloudInfo();
  }

  return {
    nxCloudInfo,
    directory,
    pushedToVcs,
    connectUrl,
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
