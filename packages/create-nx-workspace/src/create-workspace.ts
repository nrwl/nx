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
  setNeverConnectToCloud,
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
import { isAiAgent, logProgress } from './utils/ai/ai-output';

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
  preset: string | undefined,
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

    const aiMode = isAiAgent();

    // Use spinner for human mode, progress logs for AI mode
    let workspaceSetupSpinner: any;
    if (aiMode) {
      logProgress('cloning', `Cloning template ${options.template}...`);
    } else {
      const ora = require('ora');
      workspaceSetupSpinner = ora(`Creating workspace from template`).start();
    }

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
      if (aiMode) {
        logProgress(
          'installing',
          `Installing dependencies with ${packageManager}...`
        );
      }

      const pmc = getPackageManagerCommand(packageManager);
      if (pmc.preInstall) {
        await execAndWait(pmc.preInstall, directory);
      }
      await execAndWait(pmc.install, directory);

      // Mark workspace as ready for SIGINT handler
      workspaceDirectory = directory;

      if (aiMode) {
        logProgress(
          'configuring',
          `Successfully created the workspace: ${directory}`
        );
      } else {
        workspaceSetupSpinner.succeed(
          `Successfully created the workspace: ${directory}`
        );
      }
    } catch (e) {
      if (!aiMode) {
        workspaceSetupSpinner.fail();
      }
      throw e;
    }

    // Connect to Nx Cloud for template flow
    if (
      nxCloud !== 'skip' &&
      nxCloud !== 'never' &&
      !options.skipCloudConnect
    ) {
      await connectToNxCloudForTemplate(
        directory,
        'create-nx-workspace',
        useGitHub
      );
    }
  } else {
    // NXC-4020: Preset flow — restored to match v22.1.3
    if (!preset) {
      throw new Error(
        'Preset is required when not using a template. Please provide --preset or --template.'
      );
    }
    const tmpDir = await createSandbox(packageManager);
    const workspaceGlobs = getWorkspaceGlobsFromPreset(preset);

    // NXC-4020: Pass actual nxCloud value (v22.1.3 behavior) so nxCloudId is set in nx.json
    // Previous: nxCloud: 'skip' override to defer cloud connection
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

  // Handle "Never" opt-out: set neverConnectToCloud in nx.json
  if (options.neverConnectToCloud) {
    setNeverConnectToCloud(directory);
  }

  // NXC-4020: Preset flow cloud handling matches v22.1.3 exactly:
  // 1. Read token (cloud was connected during createEmptyWorkspace)
  // 2. Setup CI for specific providers (not 'yes')
  // 3. Generate onboarding URL
  // 4. Git init with connectUrl
  // 5. Show completion message
  let connectUrl: string | undefined;
  let nxCloudInfo: string | undefined;

  if (!isTemplate && nxCloud !== 'skip' && nxCloud !== 'never') {
    const token = readNxCloudToken(directory) as string;

    if (nxCloud !== 'yes') {
      await setupCI(directory, nxCloud, packageManager);
    }

    connectUrl = await createNxCloudOnboardingUrl(
      nxCloud,
      token,
      directory,
      useGitHub
    );

    // Store for SIGINT handler
    cloudConnectUrl = connectUrl;
  }

  // Template flow: CI setup and cloud connection handled separately
  if (
    isTemplate &&
    nxCloud !== 'skip' &&
    nxCloud !== 'never' &&
    nxCloud !== 'yes'
  ) {
    await setupCI(directory, nxCloud, packageManager);
  }

  let pushedToVcs = VcsPushStatus.SkippedGit;

  if (!skipGit) {
    const aiMode = isAiAgent();
    if (aiMode) {
      logProgress('initializing', 'Initializing git repository...');
    }

    try {
      // NXC-4020: Pass connectUrl to git init (v22.1.3 behavior)
      await initializeGitRepo(directory, { defaultBase, commit, connectUrl });

      // NXC-4020: Only push for github CI provider (v22.1.3 behavior)
      // Previous: also pushed for nxCloud === 'yes'
      if (commit && !skipGitHubPush && nxCloud === 'github') {
        pushedToVcs = await pushToGitHub(directory, {
          skipGitHubPush,
          name,
          defaultBase,
          verbose,
        });
      }
    } catch (e) {
      if (e instanceof Error) {
        if (!isAiAgent()) {
          output.error({
            title: 'Could not initialize git repository',
            bodyLines: mapErrorToBodyLines(e),
          });
        }
      } else {
        console.error(e);
      }
    }
  }

  // NXC-4020: Preset flow completion message matches v22.1.3
  if (!isTemplate && connectUrl) {
    nxCloudInfo = await getNxCloudInfo(
      nxCloud,
      connectUrl,
      pushedToVcs,
      rawArgs?.nxCloud
    );
  }

  // Template flow: cloud URL generation and completion message
  if (isTemplate) {
    if (nxCloud !== 'skip' && nxCloud !== 'never') {
      const aiModeForCloud = isAiAgent();
      if (aiModeForCloud) {
        logProgress('configuring', 'Configuring Nx Cloud...');
      }
      const token = options.skipCloudConnect
        ? undefined
        : readNxCloudToken(directory);

      connectUrl = await createNxCloudOnboardingUrl(
        nxCloud,
        token,
        directory,
        useGitHub
      );

      cloudConnectUrl = connectUrl;

      const readmeUpdated = addConnectUrlToReadme(directory, connectUrl);
      if (readmeUpdated && !skipGit && commit) {
        const alreadyPushed = pushedToVcs === VcsPushStatus.PushedToVcs;
        await amendOrCommitReadme(directory, alreadyPushed);
      }

      nxCloudInfo = await getNxCloudInfo(nxCloud, connectUrl, pushedToVcs);
    } else {
      // Strip marker comments from README
      const readmeUpdated = addConnectUrlToReadme(directory, undefined);
      if (readmeUpdated && !skipGit && commit) {
        const alreadyPushed = pushedToVcs === VcsPushStatus.PushedToVcs;
        await amendOrCommitReadme(directory, alreadyPushed);
      }

      if (nxCloud === 'skip') {
        nxCloudInfo = getSkippedNxCloudInfo();
      }
    }
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
