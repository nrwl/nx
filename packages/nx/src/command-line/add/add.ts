import { exec } from 'child_process';
import { existsSync } from 'fs';
import * as ora from 'ora';
import { isAngularPluginInstalled } from '../../adapter/angular-json';
import type { GeneratorsJsonEntry } from '../../config/misc-interfaces';
import { readNxJson, type NxJsonConfiguration } from '../../config/nx-json';
import { runNxAsync, runNxSync } from '../../utils/child-process';
import { writeJsonFile } from '../../utils/fileutils';
import { logger } from '../../utils/logger';
import { output } from '../../utils/output';
import {
  detectPackageManager,
  getPackageManagerCommand,
  getPackageManagerVersion,
} from '../../utils/package-manager';
import { handleErrors } from '../../utils/handle-errors';
import { getPluginCapabilities } from '../../utils/plugins';
import { nxVersion } from '../../utils/versions';
import { workspaceRoot } from '../../utils/workspace-root';
import type { AddOptions } from './command-object';
import { normalizeVersionForNxJson } from '../init/implementation/dot-nx/add-nx-scripts';
import { gte } from 'semver';

export function addHandler(options: AddOptions): Promise<number> {
  return handleErrors(options.verbose, async () => {
    output.addNewline();

    const [pkgName, version] = parsePackageSpecifier(options.packageSpecifier);
    const nxJson = readNxJson();

    await installPackage(pkgName, version, nxJson);
    await initializePlugin(pkgName, options, nxJson);

    output.success({
      title: `Package ${pkgName} added successfully.`,
    });
  });
}

async function installPackage(
  pkgName: string,
  version: string,
  nxJson: NxJsonConfiguration
): Promise<void> {
  const spinner = ora(`Installing ${pkgName}@${version}...`);
  spinner.start();

  if (existsSync('package.json')) {
    const pm = detectPackageManager();
    const pmv = getPackageManagerVersion(pm);
    const pmc = getPackageManagerCommand(pm);

    // if we explicitly specify latest in yarn berry, it won't resolve the version
    const command =
      pm === 'yarn' && gte(pmv, '2.0.0') && version === 'latest'
        ? `${pmc.addDev} ${pkgName}`
        : `${pmc.addDev} ${pkgName}@${version}`;
    await new Promise<void>((resolve) =>
      exec(
        command,
        {
          windowsHide: false,
        },
        (error, stdout) => {
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
        }
      )
    );
  } else {
    nxJson.installation.plugins ??= {};
    nxJson.installation.plugins[pkgName] = normalizeVersionForNxJson(
      pkgName,
      version
    );
    writeJsonFile('nx.json', nxJson);

    try {
      await runNxAsync('--help', { silent: true });
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
  options: AddOptions,
  nxJson: NxJsonConfiguration
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
    const args = [];
    if (coreNxPluginVersions.has(pkgName)) {
      args.push(`--keepExistingVersions`);

      if (
        options.updatePackageScripts ||
        (options.updatePackageScripts === undefined &&
          nxJson.useInferencePlugins !== false &&
          process.env.NX_ADD_PLUGINS !== 'false')
      ) {
        args.push(`--updatePackageScripts`);
      }
    }

    if (options.__overrides_unparsed__.length) {
      args.push(...options.__overrides_unparsed__);
    }

    runNxSync(`g ${pkgName}:${initGenerator} ${args.join(' ')}`, {
      stdio: [0, 1, 2],
    });
  } catch (e) {
    spinner.fail();
    output.addNewline();
    logger.error(e);
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
    if (coreNxPluginVersions.has(packageSpecifier)) {
      return [packageSpecifier, coreNxPluginVersions.get(packageSpecifier)];
    }

    return [packageSpecifier, 'latest'];
  }

  const pkgName = packageSpecifier.substring(0, i);
  const version = packageSpecifier.substring(i + 1);

  return [pkgName, version];
}

export const coreNxPluginVersions = (
  require('../../../package.json') as typeof import('../../../package.json')
)['nx-migrations'].packageGroup.reduce(
  (map, entry) => {
    const packageName = typeof entry === 'string' ? entry : entry.package;
    const version = typeof entry === 'string' ? nxVersion : entry.version;
    return map.set(packageName, version);
  },
  // Package Name -> Desired Version
  new Map<string, string>()
);
