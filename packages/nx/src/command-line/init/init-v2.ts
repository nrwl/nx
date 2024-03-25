import { existsSync } from 'fs';
import { PackageJson } from '../../utils/package-json';
import { prerelease } from 'semver';
import { output } from '../../utils/output';
import { getPackageManagerCommand } from '../../utils/package-manager';
import { generateDotNxSetup } from './implementation/dot-nx/add-nx-scripts';
import { runNxSync } from '../../utils/child-process';
import { readJsonFile, writeJsonFile } from '../../utils/fileutils';
import { nxVersion } from '../../utils/versions';
import {
  addDepsToPackageJson,
  createNxJsonFile,
  isMonorepo,
  runInstall,
  updateGitIgnore,
} from './implementation/utils';
import { prompt } from 'enquirer';
import { execSync } from 'child_process';
import { addNxToAngularCliRepo } from './implementation/angular';
import { globWithWorkspaceContext } from '../../utils/workspace-context';
import { connectExistingRepoToNxCloudPrompt } from '../connect/connect-to-nx-cloud';
import { addNxToNpmRepo } from './implementation/add-nx-to-npm-repo';
import { addNxToMonorepo } from './implementation/add-nx-to-monorepo';
import { join } from 'path';

export interface InitArgs {
  interactive: boolean;
  nxCloud?: boolean;
  useDotNxInstallation?: boolean;
  integrated?: boolean; // For Angular projects only
}

export async function initHandler(options: InitArgs): Promise<void> {
  process.env.NX_RUNNING_NX_INIT = 'true';
  const version =
    process.env.NX_VERSION ?? (prerelease(nxVersion) ? 'next' : 'latest');
  if (process.env.NX_VERSION) {
    output.log({ title: `Using version ${process.env.NX_VERSION}` });
  }

  if (!existsSync('package.json') || options.useDotNxInstallation) {
    if (process.platform !== 'win32') {
      console.log(
        'Setting Nx up installation in `.nx`. You can run Nx commands like: `./nx --help`'
      );
    } else {
      console.log(
        'Setting Nx up installation in `.nx`. You can run Nx commands like: `./nx.bat --help`'
      );
    }
    generateDotNxSetup(version);
    const { plugins } = await detectPlugins();
    plugins.forEach((plugin) => {
      execSync(`./nx add ${plugin}`, {
        stdio: 'inherit',
      });
    });

    // invokes the wrapper, thus invoking the initial installation process
    runNxSync('--version', { stdio: 'ignore' });
    return;
  }

  // TODO(jack): Remove this Angular logic once `@nx/angular` is compatible with inferred targets.
  if (existsSync('angular.json')) {
    await addNxToAngularCliRepo({
      ...options,
      integrated: !!options.integrated,
    });
    return;
  }

  output.log({ title: '🧐 Checking dependencies' });

  const { plugins, updatePackageScripts } = await detectPlugins();

  if (!plugins.length) {
    // If no plugins are detected/chosen, guide users to setup
    // their targetDefaults correctly so their package scripts will work.
    const packageJson: PackageJson = readJsonFile('package.json');
    if (isMonorepo(packageJson)) {
      await addNxToMonorepo({ interactive: options.interactive });
    } else {
      await addNxToNpmRepo({ interactive: options.interactive });
    }
  } else {
    const useNxCloud =
      options.nxCloud ??
      (options.interactive
        ? await connectExistingRepoToNxCloudPrompt()
        : false);

    const repoRoot = process.cwd();
    const pmc = getPackageManagerCommand();

    createNxJsonFile(repoRoot, [], [], {});
    updateGitIgnore(repoRoot);

    addDepsToPackageJson(repoRoot, plugins);

    output.log({ title: '📦 Installing Nx' });

    runInstall(repoRoot, pmc);

    output.log({ title: '🔨 Configuring plugins' });
    for (const plugin of plugins) {
      execSync(
        `${pmc.exec} nx g ${plugin}:init --keepExistingVersions ${
          updatePackageScripts ? '--updatePackageScripts' : ''
        } --no-interactive`,
        {
          stdio: [0, 1, 2],
          cwd: repoRoot,
        }
      );
    }

    if (!updatePackageScripts) {
      const rootPackageJsonPath = join(repoRoot, 'package.json');
      const json = readJsonFile<PackageJson>(rootPackageJsonPath);
      json.nx = { includedScripts: [] };
      writeJsonFile(rootPackageJsonPath, json);
    }

    if (useNxCloud) {
      output.log({ title: '🛠️ Setting up Nx Cloud' });
      execSync(
        `${pmc.exec} nx g nx:connect-to-nx-cloud --installationSource=nx-init --quiet --hideFormatLogs --no-interactive`,
        {
          stdio: [0, 1, 2],
          cwd: repoRoot,
        }
      );
    }
  }

  output.log({
    title: '👀 Explore Your Workspace',
    bodyLines: [
      `Run "nx graph" to show the graph of the workspace. It will show tasks that you can run with Nx.`,
      `Read this guide on exploring your workspace: https://nx.dev/core-features/explore-graph`,
    ],
  });
}

const npmPackageToPluginMap: Record<string, string> = {
  // Generic JS tools
  eslint: '@nx/eslint',
  storybook: '@nx/storybook',
  // Bundlers
  vite: '@nx/vite',
  vitest: '@nx/vite',
  webpack: '@nx/webpack',
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
};

async function detectPlugins(): Promise<{
  plugins: string[];
  updatePackageScripts: boolean;
}> {
  let files = ['package.json'].concat(
    globWithWorkspaceContext(process.cwd(), ['**/*/package.json'])
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

    for (const [dep, plugin] of Object.entries(npmPackageToPluginMap)) {
      if (deps[dep]) {
        detectedPlugins.add(plugin);
      }
    }
  }
  if (existsSync('gradlew') || existsSync('gradlew.bat')) {
    detectedPlugins.add('@nx/gradle');
  }

  const plugins = Array.from(detectedPlugins);

  if (plugins.length === 0) {
    return {
      plugins: [],
      updatePackageScripts: false,
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
      message: `Which plugins would you like to add?`,
      choices: plugins.map((p) => ({ name: p, value: p })),
      initial: plugins.map((_, i) => i) as unknown as number, // casting to avoid type error due to bad d.ts file from enquirer
    },
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
