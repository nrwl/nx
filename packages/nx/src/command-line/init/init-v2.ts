import { existsSync } from 'fs';

import { prompt } from 'enquirer';
import { prerelease } from 'semver';
import { NxJsonConfiguration, readNxJson } from '../../config/nx-json';
import { readJsonFile } from '../../utils/fileutils';
import { getPackageNameFromImportPath } from '../../utils/get-package-name-from-import-path';
import { output } from '../../utils/output';
import { PackageJson } from '../../utils/package-json';
import {
  detectPackageManager,
  getPackageManagerCommand,
} from '../../utils/package-manager';
import { nxVersion } from '../../utils/versions';
import { globWithWorkspaceContextSync } from '../../utils/workspace-context';
import { connectExistingRepoToNxCloudPrompt } from '../nx-cloud/connect/connect-to-nx-cloud';
import { configurePlugins, installPluginPackages } from './configure-plugins';
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

export interface InitArgs {
  interactive: boolean;
  nxCloud?: boolean;
  useDotNxInstallation?: boolean;
  integrated?: boolean; // For Angular projects only
  verbose?: boolean;
  force?: boolean;
}

export async function initHandler(options: InitArgs): Promise<void> {
  process.env.NX_RUNNING_NX_INIT = 'true';
  const version =
    process.env.NX_VERSION ?? (prerelease(nxVersion) ? nxVersion : 'latest');
  if (process.env.NX_VERSION) {
    output.log({ title: `Using version ${process.env.NX_VERSION}` });
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

  let guided = true;
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
    await addNxToCraRepo({
      addE2e: false,
      force: options.force,
      vite: true,
      integrated: false,
      interactive: options.interactive,
      nxCloud: false,
    });
  } else if (_isMonorepo) {
    await addNxToMonorepo(
      {
        interactive: options.interactive,
        nxCloud: false,
      },
      guided
    );
  } else if (_isNonJs) {
    generateDotNxSetup(version);
    console.log('');
  } else {
    await addNxToNpmRepo(
      {
        interactive: options.interactive,
        nxCloud: false,
      },
      guided
    );
  }

  const repoRoot = process.cwd();

  createNxJsonFile(repoRoot, [], [], {});
  updateGitIgnore(repoRoot);

  const nxJson = readNxJson(repoRoot);

  if (guided) {
    output.log({ title: '🧐 Checking dependencies' });

    let plugins: string[];
    let updatePackageScripts: boolean;

    if (_isCRA) {
      plugins = ['@nx/vite'];
      updatePackageScripts = true;
    } else {
      const { plugins: _plugins, updatePackageScripts: _updatePackageScripts } =
        await detectPlugins(nxJson, options.interactive);
      plugins = _plugins;
      updatePackageScripts = _updatePackageScripts;
    }

    output.log({ title: '📦 Installing Nx' });

    installPluginPackages(repoRoot, pmc, plugins);
    await configurePlugins(
      plugins,
      updatePackageScripts,
      pmc,
      repoRoot,
      options.verbose
    );
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

  printFinalMessage({
    learnMoreLink: _isMonorepo
      ? 'https://nx.dev/recipes/adopting-nx/adding-to-monorepo'
      : 'https://nx.dev/getting-started/adding-to-existing',
    appendLines: _isMonorepo
      ? [
          `- Learn how Nx helps manage your TypeScript monorepo at https://nx.dev/features/maintain-ts-monorepos.`,
        ]
      : [],
  });
}

const npmPackageToPluginMap: Record<string, `@nx/${string}`> = {
  // Generic JS tools
  eslint: '@nx/eslint',
  storybook: '@nx/storybook',
  // Bundlers
  vite: '@nx/vite',
  vitest: '@nx/vite',
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
