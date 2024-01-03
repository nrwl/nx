import { exec } from 'child_process';
import * as ora from 'ora';
import { isAngularPluginInstalled } from '../../adapter/angular-json';
import type { GeneratorsJsonEntry } from '../../config/misc-interfaces';
import { logger } from '../../utils/logger';
import { output } from '../../utils/output';
import {
  getPackageManagerCommand,
  type PackageManagerCommands,
} from '../../utils/package-manager';
import { handleErrors } from '../../utils/params';
import { getPluginCapabilities } from '../../utils/plugins';
import { workspaceRoot } from '../../utils/workspace-root';
import type { AddOptions } from './command-object';

export function addHandler(args: AddOptions): Promise<void> {
  if (args.verbose) {
    process.env.NX_VERBOSE_LOGGING = 'true';
  }
  const isVerbose = process.env.NX_VERBOSE_LOGGING === 'true';

  return handleErrors(isVerbose, async () => {
    output.addNewline();

    const pmc = getPackageManagerCommand();
    const [pkgName, version] = parsePackageSpecifier(args.packageSpecifier);

    await installPackage(pkgName, version, pmc);
    await initializePlugin(pkgName, pmc);

    output.success({
      title: `Package ${pkgName} added successfully.`,
    });
  });
}

async function installPackage(
  pkgName: string,
  version: string,
  packageManagerCommands: PackageManagerCommands
): Promise<void> {
  const spinner = ora(`Installing ${pkgName}@${version}...`);
  spinner.start();

  await new Promise<void>((resolve) =>
    exec(
      `${packageManagerCommands.addDev} ${pkgName}@${version}`,
      (error, stdout) => {
        if (error) {
          spinner.fail();
          output.addNewline();
          logger.log(stdout);
          process.exit(1);
        }

        return resolve();
      }
    )
  );

  spinner.succeed();
}

async function initializePlugin(
  pkgName: string,
  packageManagerCommands: PackageManagerCommands
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

  await new Promise<void>((resolve) =>
    exec(
      `${packageManagerCommands.exec} nx g ${pkgName}:${initGenerator}`,
      (error, stdout) => {
        if (error) {
          spinner.fail();
          output.addNewline();
          logger.log(stdout);
          process.exit(1);
        }

        return resolve();
      }
    )
  );

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
    return [packageSpecifier, 'latest'];
  }

  const pkgName = packageSpecifier.substring(0, i);
  const version = packageSpecifier.substring(i + 1);

  return [pkgName, version];
}
