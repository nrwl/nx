import { exec } from 'child_process';
import { existsSync } from 'fs';
import * as ora from 'ora';
import { isAngularPluginInstalled } from '../../adapter/angular-json';
import type { GeneratorsJsonEntry } from '../../config/misc-interfaces';
import { readNxJson } from '../../config/nx-json';
import { runNxAsync } from '../../utils/child-process';
import { writeJsonFile } from '../../utils/fileutils';
import { logger } from '../../utils/logger';
import { output } from '../../utils/output';
import { getPackageManagerCommand } from '../../utils/package-manager';
import { handleErrors } from '../../utils/params';
import { getPluginCapabilities } from '../../utils/plugins';
import { nxVersion } from '../../utils/versions';
import { workspaceRoot } from '../../utils/workspace-root';
import type { AddOptions } from './command-object';

export function addHandler(options: AddOptions): Promise<void> {
  if (options.verbose) {
    process.env.NX_VERBOSE_LOGGING = 'true';
  }
  const isVerbose = process.env.NX_VERBOSE_LOGGING === 'true';

  return handleErrors(isVerbose, async () => {
    output.addNewline();

    const [pkgName, version] = parsePackageSpecifier(options.packageSpecifier);

    await installPackage(pkgName, version);
    await initializePlugin(pkgName, options);

    output.success({
      title: `Package ${pkgName} added successfully.`,
    });
  });
}

async function installPackage(pkgName: string, version: string): Promise<void> {
  const spinner = ora(`Installing ${pkgName}@${version}...`);
  spinner.start();

  if (existsSync('package.json')) {
    const pmc = getPackageManagerCommand();
    await new Promise<void>((resolve) =>
      exec(`${pmc.addDev} ${pkgName}@${version}`, (error, stdout) => {
        if (error) {
          spinner.fail();
          output.addNewline();
          logger.error(stdout);
          output.error({
            title: `Failed to install ${pkgName}. Please check the error above for more details.`,
          });
          process.exit(1);
        }

        return resolve();
      })
    );
  } else {
    const nxJson = readNxJson();
    nxJson.installation.plugins ??= {};
    nxJson.installation.plugins[pkgName] = version;
    writeJsonFile('nx.json', nxJson);

    try {
      await runNxAsync('');
    } catch (e) {
      // revert adding the plugin to nx.json
      nxJson.installation.plugins[pkgName] = undefined;
      writeJsonFile('nx.json', nxJson);

      spinner.fail();
      output.addNewline();
      logger.error(e.message);
      output.error({
        title: `Failed to install ${pkgName}. Please check the error above for more details.`,
      });
      process.exit(1);
    }
  }

  spinner.succeed();
}

async function initializePlugin(
  pkgName: string,
  options: AddOptions
): Promise<void> {
  const capabilities = await getPluginCapabilities(workspaceRoot, pkgName, {});
  const generators = capabilities?.generators;
  if (!generators) {
    output.log({
      title: `No generators found in ${pkgName}. Skipping initialization.`,
    });
    return;
  }

  const initGenerator = findInitGenerator(generators);
  if (!initGenerator) {
    output.log({
      title: `No "init" generator found in ${pkgName}. Skipping initialization.`,
    });
    return;
  }

  const spinner = ora(`Initializing ${pkgName}...`);
  spinner.start();

  try {
    let updatePackageScripts: boolean;
    if (options.updatePackageScripts !== undefined) {
      updatePackageScripts = options.updatePackageScripts;
    } else {
      updatePackageScripts =
        process.env.NX_ADD_PLUGINS !== 'false' &&
        coreNxPlugins.includes(pkgName);
    }
    await runNxAsync(
      `g ${pkgName}:${initGenerator} --keepExistingVersions${
        updatePackageScripts ? ' --updatePackageScripts' : ''
      }`
    );
  } catch (e) {
    spinner.fail();
    output.addNewline();
    logger.error(e.message);
    output.error({
      title: `Failed to initialize ${pkgName}. Please check the error above for more details.`,
    });
    process.exit(1);
  }

  spinner.succeed();
}

function findInitGenerator(
  generators: Record<string, GeneratorsJsonEntry>
): string | undefined {
  if (generators['init']) {
    return 'init';
  }

  const angularPluginInstalled = isAngularPluginInstalled();
  if (angularPluginInstalled && generators['ng-add']) {
    return 'ng-add';
  }

  return Object.keys(generators).find(
    (name) =>
      generators[name].aliases?.includes('init') ||
      (angularPluginInstalled && generators[name].aliases?.includes('ng-add'))
  );
}

function parsePackageSpecifier(
  packageSpecifier: string
): [pkgName: string, version: string] {
  const i = packageSpecifier.lastIndexOf('@');

  if (i <= 0) {
    if (coreNxPlugins.includes(packageSpecifier)) {
      return [packageSpecifier, nxVersion];
    }

    return [packageSpecifier, 'latest'];
  }

  const pkgName = packageSpecifier.substring(0, i);
  const version = packageSpecifier.substring(i + 1);

  return [pkgName, version];
}

const coreNxPlugins = [
  '@nx/angular',
  '@nx/cypress',
  '@nx/detox',
  '@nx/devkit',
  '@nx/esbuild',
  '@nx/eslint',
  '@nx/eslint-plugin',
  '@nx/expo',
  '@nx/express',
  '@nx/jest',
  '@nx/nest',
  '@nx/next',
  '@nx/node',
  '@nx/nuxt',
  '@nx/playwright',
  '@nx/plugin',
  '@nx/react',
  '@nx/react-native',
  '@nx/remix',
  '@nx/rollup',
  '@nx/storybook',
  '@nx/vite',
  '@nx/vue',
  '@nx/web',
  '@nx/webpack',
  '@nx/workspace',
];
