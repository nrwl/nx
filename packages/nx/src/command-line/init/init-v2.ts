import { existsSync } from 'fs';

import { prompt } from 'enquirer';
import { prerelease } from 'semver';
import { NxJsonConfiguration, readNxJson } from '../../config/nx-json';
import { readJsonFile } from '../../utils/fileutils';
import { getPackageNameFromImportPath } from '../../utils/get-package-name-from-import-path';
import { output } from '../../utils/output';
import { PackageJson } from '../../utils/package-json';
import { getPackageManagerCommand } from '../../utils/package-manager';
import { nxVersion } from '../../utils/versions';
import { globWithWorkspaceContextSync } from '../../utils/workspace-context';
import { connectExistingRepoToNxCloudPrompt } from '../nx-cloud/connect/connect-to-nx-cloud';
import { configurePlugins, installPluginPackages } from './configure-plugins';
import { determineAiAgents } from './ai-agent-prompts';
import { setupAiAgentsGenerator } from '../../ai/set-up-ai-agents/set-up-ai-agents';
import { FsTree, flushChanges } from '../../generators/tree';
import { addNxToMonorepo } from './implementation/add-nx-to-monorepo';
import { addNxToNpmRepo } from './implementation/add-nx-to-npm-repo';
import { addNxToTurborepo } from './implementation/add-nx-to-turborepo';
import { addNxToAngularCliRepo } from './implementation/angular';
import { generateDotNxSetup } from './implementation/dot-nx/add-nx-scripts';
import {
  createNxJsonFile,
  initCloud,
  isCRA,
  isMonorepo,
  printFinalMessage,
  updateGitIgnore,
} from './implementation/utils';
import { addNxToCraRepo } from './implementation/react';
import { ensurePackageHasProvenance } from '../../utils/provenance';
import { installPackageToTmp } from '../../devkit-internals';
import { isAiAgent } from '../../native';
import { Agent } from '../../ai/utils';
import { detectAiAgent } from '../../ai/detect-ai-agent';
import {
  logProgress,
  writeAiOutput,
  buildNeedsInputResult,
  buildSuccessResult,
  buildErrorResult,
  writeErrorLog,
  determineErrorCode,
  DetectedPlugin,
} from './utils/ai-output';
import { reportCommandRunEvent } from '../../analytics';

export interface InitArgs {
  interactive: boolean;
  nxCloud?: boolean;
  useDotNxInstallation?: boolean;
  integrated?: boolean; // For Angular projects only
  verbose?: boolean;
  force?: boolean;
  aiAgents?: Agent[];
  plugins?: string; // 'skip' | 'all' | comma-separated list
  cacheable?: string[]; // Cacheable operations (e.g., ['build', 'test', 'lint'])
}

export async function initHandler(
  options: InitArgs,
  inner = false
): Promise<void> {
  reportCommandRunEvent('init-v2');
  // Use environment variable to force local execution
  if (process.env.NX_USE_LOCAL === 'true' || inner) {
    return await initHandlerImpl(options);
  }

  let cleanup: () => void | undefined;
  try {
    await ensurePackageHasProvenance('nx', 'latest');
    const packageInstallResults = installPackageToTmp('nx', 'latest');
    cleanup = packageInstallResults.cleanup;

    let modulePath = require.resolve('nx/src/command-line/init/init-v2.js', {
      paths: [packageInstallResults.tempDir],
    });

    const module = await import(modulePath);
    const result = await module.initHandler(options, true);
    cleanup();
    return result;
  } catch (error) {
    if (cleanup) {
      cleanup();
    }
    // Fall back to local implementation
    return initHandlerImpl(options);
  }
}

async function initHandlerImpl(options: InitArgs): Promise<void> {
  process.env.NX_RUNNING_NX_INIT = 'true';
  const version =
    process.env.NX_VERSION ?? (prerelease(nxVersion) ? nxVersion : 'latest');
  if (process.env.NX_VERSION) {
    output.log({ title: `Using version ${process.env.NX_VERSION}` });
  }

  // AI agent mode: apply defaults for non-interactive operation
  const aiMode = isAiAgent();
  if (aiMode) {
    options.interactive = false; // Force non-interactive

    if (options.nxCloud === undefined) {
      options.nxCloud = false; // Default to skip Nx Cloud
    }

    // Auto-detect .nx installation for non-JS projects
    if (options.useDotNxInstallation === undefined) {
      const hasPackageJson = existsSync('package.json');
      options.useDotNxInstallation = !hasPackageJson;
    }

    // Auto-detect and set the current AI agent for setup
    if (options.aiAgents === undefined) {
      const detectedAgent = detectAiAgent();
      if (detectedAgent) {
        options.aiAgents = [detectedAgent];
      }
    }

    // Set default cacheable operations for AI mode
    // These are commonly cacheable scripts that benefit from caching
    if (options.cacheable === undefined) {
      options.cacheable = ['build', 'test', 'lint'];
    }

    logProgress('starting', 'Initializing Nx...');
  }

  // TODO(jack): Remove this Angular logic once `@nx/angular` is compatible with inferred targets.
  if (existsSync('angular.json')) {
    await addNxToAngularCliRepo({
      ...options,
      integrated: !!options.integrated,
    });

    printFinalMessage({
      learnMoreLink: 'https://nx.dev/technologies/angular/migration/angular',
    });
    return;
  }

  const _isNonJs = !existsSync('package.json') || options.useDotNxInstallation;
  const packageJson: PackageJson = _isNonJs
    ? null
    : readJsonFile('package.json');
  const _isTurborepo = existsSync('turbo.json');
  const _isMonorepo = _isNonJs ? false : isMonorepo(packageJson);
  const _isCRA = _isNonJs ? false : isCRA(packageJson);

  // AI mode defaults to minimum setup, humans can choose
  let guided = !aiMode; // Default to minimum (false) for AI, guided (true) for humans
  if (options.interactive && !(_isTurborepo || _isCRA || _isNonJs)) {
    const setupType = await prompt<{ setupPreference: string }>([
      {
        type: 'select',
        name: 'setupPreference',
        message: 'Would you like a minimum or guided setup?',
        choices: [{ name: 'Minimum' }, { name: 'Guided' }],
      },
    ]).then((r) => r.setupPreference);
    guided = setupType === 'Guided';
  }

  /**
   * Turborepo users must have set up individual scripts already, and we keep the transition as minimal as possible.
   * We log a message during the conversion process in addNxToTurborepo about how they can learn more about the power
   * of Nx plugins and how it would allow them to infer all the relevant scripts automatically, including all cache
   * inputs and outputs.
   */
  if (_isTurborepo) {
    if (aiMode) {
      logProgress('detecting', 'Detected Turborepo project');
    }
    await addNxToTurborepo({
      interactive: options.interactive,
    });
    printFinalMessage({
      learnMoreLink: 'https://nx.dev/recipes/adopting-nx/from-turborepo',
    });
    return;
  }

  const pmc = getPackageManagerCommand();

  if (_isCRA) {
    if (aiMode) {
      logProgress('detecting', 'Detected Create React App project');
    }
    await addNxToCraRepo({
      addE2e: false,
      force: options.force,
      vite: true,
      integrated: false,
      interactive: options.interactive,
      nxCloud: false,
    });
  } else if (_isMonorepo) {
    if (aiMode) {
      logProgress('detecting', 'Detected monorepo project');
    }
    await addNxToMonorepo(
      {
        interactive: options.interactive,
        nxCloud: false,
        cacheable: options.cacheable,
      },
      guided
    );
  } else if (_isNonJs) {
    if (aiMode) {
      logProgress('detecting', 'Detected non-JavaScript project');
    }
    generateDotNxSetup(version);
    console.log('');
  } else {
    if (aiMode) {
      logProgress('detecting', 'Detected NPM project');
    }
    await addNxToNpmRepo(
      {
        interactive: options.interactive,
        nxCloud: false,
        cacheable: options.cacheable,
      },
      guided
    );
  }

  const repoRoot = process.cwd();

  if (aiMode) {
    logProgress('configuring', 'Creating nx.json...');
  }
  createNxJsonFile(repoRoot, [], options.cacheable ?? [], {});
  updateGitIgnore(repoRoot);

  const nxJson = readNxJson(repoRoot);

  // Handle plugins based on mode and flags
  let pluginsToInstall: string[] = [];
  let updatePackageScripts = false;

  if (aiMode) {
    // AI mode: handle --plugins flag
    const parsedPlugins = parsePluginsFlag(options.plugins);

    if (parsedPlugins === 'skip') {
      // Skip plugins entirely
      logProgress('detecting', 'Skipping plugin installation');
      pluginsToInstall = [];
    } else {
      // Need to detect plugins for 'all' or to return needs_input
      logProgress('detecting', 'Checking for recommended plugins...');

      let detectedPluginNames: string[];
      if (_isCRA) {
        detectedPluginNames = ['@nx/vite'];
      } else {
        const { plugins: detected } = await detectPlugins(
          nxJson,
          packageJson,
          false // non-interactive
        );
        detectedPluginNames = detected;
      }

      if (parsedPlugins === 'all') {
        // Install all detected plugins
        pluginsToInstall = detectedPluginNames;
        updatePackageScripts = true;
      } else if (Array.isArray(parsedPlugins)) {
        // Install specific plugins from the comma-separated list
        pluginsToInstall = parsedPlugins;
        updatePackageScripts = true;
      } else if (detectedPluginNames.length > 0) {
        // No --plugins flag provided and plugins were detected
        // Return needs_input for AI to ask user
        const detectedPlugins: DetectedPlugin[] = detectedPluginNames.map(
          (name) => ({
            name,
            reason: getPluginReason(name),
          })
        );

        logProgress(
          'detecting',
          `Detected ${detectedPluginNames.length} plugin(s): ${detectedPluginNames.join(', ')}`
        );
        writeAiOutput(buildNeedsInputResult(detectedPlugins));
        process.exit(0);
      }
      // else: no plugins flag and no plugins detected, proceed with empty array
    }

    if (pluginsToInstall.length > 0) {
      logProgress('installing', 'Installing Nx packages...');

      for (const plugin of pluginsToInstall) {
        logProgress('plugins', `Installing ${plugin}...`);
      }

      installPluginPackages(repoRoot, pmc, pluginsToInstall);
      await configurePlugins(
        pluginsToInstall,
        updatePackageScripts,
        pmc,
        repoRoot,
        options.verbose
      );
    }
  } else if (guided) {
    // Non-AI guided mode: existing behavior with interactive prompts
    output.log({ title: '🧐 Checking dependencies' });

    if (_isCRA) {
      pluginsToInstall = ['@nx/vite'];
      updatePackageScripts = true;
    } else {
      const { plugins: _plugins, updatePackageScripts: _updatePackageScripts } =
        await detectPlugins(nxJson, packageJson, options.interactive);
      pluginsToInstall = _plugins;
      updatePackageScripts = _updatePackageScripts;
    }

    if (pluginsToInstall.length > 0) {
      output.log({ title: '📦 Installing Nx' });

      installPluginPackages(repoRoot, pmc, pluginsToInstall);
      await configurePlugins(
        pluginsToInstall,
        updatePackageScripts,
        pmc,
        repoRoot,
        options.verbose
      );
    }
  }

  const selectedAgents = await determineAiAgents(
    options.aiAgents,
    options.interactive && guided
  );

  if (selectedAgents && selectedAgents.length > 0) {
    const tree = new FsTree(repoRoot, false);
    const aiAgentsCallback = await setupAiAgentsGenerator(tree, {
      directory: '.',
      writeNxCloudRules: options.nxCloud !== false,
      packageVersion: 'latest',
      agents: [...selectedAgents],
    });

    const changes = tree.listChanges();
    flushChanges(repoRoot, changes);

    if (aiAgentsCallback) {
      const results = await aiAgentsCallback();
      results.messages.forEach((m) => output.log(m));
      results.errors.forEach((e) => output.error(e));
    }
  }

  let useNxCloud: any = options.nxCloud;
  if (useNxCloud === undefined) {
    output.log({ title: '🛠️ Setting up Self-Healing CI and Remote Caching' });
    useNxCloud = options.interactive
      ? await connectExistingRepoToNxCloudPrompt()
      : false;
  }
  if (useNxCloud) {
    await initCloud('nx-init');
  }

  // Output success result for AI agents
  if (aiMode) {
    writeAiOutput(
      buildSuccessResult({
        nxVersion: version,
        pluginsInstalled: pluginsToInstall,
      })
    );
  }

  // Skip human-readable output for AI agents
  if (!aiMode) {
    printFinalMessage({
      learnMoreLink: 'https://nx.dev/getting-started/adding-to-existing',
      appendLines: _isMonorepo
        ? [
            `- Read a detailed guide about adding Nx to NPM/YARN/PNPM workspaces: https://nx.dev/recipes/adopting-nx/adding-to-monorepos`,
            `- Learn how Nx helps manage your TypeScript monorepo: https://nx.dev/features/maintain-ts-monorepos`,
          ]
        : [],
    });
  }
}

/**
 * Generate a reason for why a plugin was detected.
 * Used for AI `needs_input` output.
 */
export function getPluginReason(plugin: string): string {
  const reasonMap: Record<string, string> = {
    '@nx/eslint': 'eslint detected in dependencies',
    '@nx/storybook': 'storybook detected in dependencies',
    '@nx/vite': 'vite detected in dependencies',
    '@nx/vitest': 'vitest detected in dependencies',
    '@nx/webpack': 'webpack detected in dependencies',
    '@nx/rspack': '@rspack/core detected in dependencies',
    '@nx/rollup': 'rollup detected in dependencies',
    '@nx/jest': 'jest detected in dependencies',
    '@nx/cypress': 'cypress detected in dependencies',
    '@nx/playwright': '@playwright/test detected in dependencies',
    '@nx/detox': 'detox detected in dependencies',
    '@nx/expo': 'expo detected in dependencies',
    '@nx/next': 'next.js detected in dependencies',
    '@nx/nuxt': 'nuxt detected in dependencies',
    '@nx/react-native': 'react-native detected in dependencies',
    '@nx/remix': '@remix-run/dev detected in dependencies',
    '@nx/rsbuild': '@rsbuild/core detected in dependencies',
    '@nx/react': '@react-router/dev detected in dependencies',
    '@nx/gradle': 'gradlew detected in workspace',
    '@nx/dotnet': '.NET project files detected',
    '@nx/maven': 'maven project files detected',
    '@nx/docker': 'Dockerfile detected in workspace',
  };
  return reasonMap[plugin] || `${plugin} detected`;
}

/**
 * Parse the --plugins flag value.
 * Returns: 'skip' | 'all' | string[] (specific plugins)
 */
function parsePluginsFlag(
  value: string | undefined
): 'skip' | 'all' | string[] | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === 'skip') {
    return 'skip';
  }
  if (value === 'all') {
    return 'all';
  }
  // Comma-separated list - filter out empty strings from edge cases like "--plugins=" or "--plugins=,"
  return value
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
}

const npmPackageToPluginMap: Record<string, `@nx/${string}`> = {
  // Generic JS tools
  eslint: '@nx/eslint',
  storybook: '@nx/storybook',
  // Bundlers
  vite: '@nx/vite',
  vitest: '@nx/vitest',
  webpack: '@nx/webpack',
  '@rspack/core': '@nx/rspack',
  rollup: '@nx/rollup',
  // Testing tools
  jest: '@nx/jest',
  cypress: '@nx/cypress',
  '@playwright/test': '@nx/playwright',
  // Frameworks
  detox: '@nx/detox',
  expo: '@nx/expo',
  next: '@nx/next',
  nuxt: '@nx/nuxt',
  'react-native': '@nx/react-native',
  '@remix-run/dev': '@nx/remix',
  '@rsbuild/core': '@nx/rsbuild',
  '@react-router/dev': '@nx/react',
};

export async function detectPlugins(
  nxJson: NxJsonConfiguration,
  packageJson: PackageJson | null,
  interactive: boolean,
  includeAngularCli?: boolean
): Promise<{
  plugins: string[];
  updatePackageScripts: boolean;
}> {
  let files = ['package.json'].concat(
    globWithWorkspaceContextSync(process.cwd(), ['**/*/package.json'])
  );

  const currentPlugins = new Set(
    (nxJson.plugins ?? []).map((p) => {
      const plugin = typeof p === 'string' ? p : p.plugin;
      return getPackageNameFromImportPath(plugin);
    })
  );

  // Also treat already-installed @nx/* and @nrwl/* packages as current plugins
  const rootDeps = {
    ...packageJson?.dependencies,
    ...packageJson?.devDependencies,
  };
  for (const dep of Object.keys(rootDeps)) {
    if (dep.startsWith('@nx/') || dep.startsWith('@nrwl/')) {
      currentPlugins.add(getPackageNameFromImportPath(dep));
    }
  }

  const detectedPlugins = new Set<string>();
  for (const file of files) {
    if (!existsSync(file)) continue;

    let packageJson: PackageJson;
    try {
      packageJson = readJsonFile(file);
    } catch {
      // Could have malformed JSON for unit tests, etc.
      continue;
    }

    const deps = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
    };

    const _npmPackageToPluginMap = {
      ...npmPackageToPluginMap,
    };
    if (includeAngularCli) {
      _npmPackageToPluginMap['@angular/cli'] = '@nx/angular';
    }
    for (const [dep, plugin] of Object.entries(_npmPackageToPluginMap)) {
      if (deps[dep]) {
        detectedPlugins.add(plugin);
      }
    }
  }

  let gradlewFiles = ['gradlew', 'gradlew.bat'].concat(
    globWithWorkspaceContextSync(process.cwd(), [
      '**/gradlew',
      '**/gradlew.bat',
    ])
  );
  if (gradlewFiles.some((f) => existsSync(f))) {
    detectedPlugins.add('@nx/gradle');
  }

  const dotnetProjectGlobs = ['**/*.csproj', '**/*.fsproj', '**/*.vbproj'];
  const dotnetFiles = globWithWorkspaceContextSync(process.cwd(), [
    ...dotnetProjectGlobs,
  ]);
  if (dotnetFiles.length > 0) {
    detectedPlugins.add('@nx/dotnet');
  }

  let mvnwFiles = globWithWorkspaceContextSync(process.cwd(), [
    'mvnw',
    'mvnw.cmd',
    'pom.xml',
    '**/mvnw',
    '**/mvnw.cmd',
    '**/pom.xml',
  ]);
  if (mvnwFiles.length > 0) {
    detectedPlugins.add('@nx/maven');
  }

  let dockerFiles = ['Dockerfile'].concat(
    globWithWorkspaceContextSync(process.cwd(), ['**/Dockerfile'])
  );
  if (dockerFiles.some((f) => existsSync(f))) {
    detectedPlugins.add('@nx/docker');
  }

  // Remove existing plugins
  for (const plugin of detectedPlugins) {
    if (currentPlugins.has(plugin)) {
      detectedPlugins.delete(plugin);
    }
  }

  const plugins = Array.from(detectedPlugins);

  if (plugins.length === 0) {
    return {
      plugins: [],
      updatePackageScripts: false,
    };
  }

  if (!interactive) {
    output.log({
      title: `Recommended Plugins:`,
      bodyLines: [
        `Adding these Nx plugins to integrate with the tools used in your workspace:`,
        ...plugins.map((p) => `- ${p}`),
      ],
    });
    return {
      plugins,
      updatePackageScripts: true,
    };
  }

  output.log({
    title: `Recommended Plugins:`,
    bodyLines: [
      `Add these Nx plugins to integrate with the tools used in your workspace.`,
    ],
  });

  const pluginsToInstall = await prompt<{ plugins: string[] }>([
    {
      name: 'plugins',
      type: 'multiselect',
      message: `Which plugins would you like to add? Press <Space> to select and <Enter> to submit.`,
      choices: plugins.map((p) => ({ name: p, value: p })),
      /**
       * limit is missing from the interface but it limits the amount of options shown
       */
      limit: process.stdout.rows - 4, // 4 leaves room for the header above, the prompt and some whitespace
    } as any,
  ]).then((r) => r.plugins);

  if (pluginsToInstall?.length === 0)
    return {
      plugins: [],
      updatePackageScripts: false,
    };

  const updatePackageScripts =
    existsSync('package.json') &&
    (await prompt<{ updatePackageScripts: string }>([
      {
        name: 'updatePackageScripts',
        type: 'autocomplete',
        message: `Do you want to start using Nx in your package.json scripts?`,
        choices: [
          {
            name: 'Yes',
          },
          {
            name: 'No',
          },
        ],
        initial: 0,
      },
    ]).then((r) => r.updatePackageScripts === 'Yes'));

  return { plugins: pluginsToInstall, updatePackageScripts };
}
