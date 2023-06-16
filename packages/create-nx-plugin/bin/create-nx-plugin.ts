#!/usr/bin/env node
import chalk = require('chalk');
import enquirer = require('enquirer');
import yargs = require('yargs');

import {
  determineCI,
  determineDefaultBase,
  determineNxCloud,
  determinePackageManager,
} from 'create-nx-workspace/src/internal-utils/prompts';
import {
  withAllPrompts,
  withCI,
  withGitOptions,
  withNxCloud,
  withOptions,
  withPackageManager,
} from 'create-nx-workspace/src/internal-utils/yargs-options';
import { createWorkspace, CreateWorkspaceOptions } from 'create-nx-workspace';
import { output } from 'create-nx-workspace/src/utils/output';
import { CI } from 'create-nx-workspace/src/utils/ci/ci-list';
import type { PackageManager } from 'create-nx-workspace/src/utils/package-manager';
import { showNxWarning } from 'create-nx-workspace/src/utils/nx/show-nx-warning';
import { printNxCloudSuccessMessage } from 'create-nx-workspace/src/utils/nx/nx-cloud';
import {
  messages,
  recordStat,
} from 'create-nx-workspace/src/utils/nx/ab-testing';

export const yargsDecorator = {
  'Options:': `${chalk.green`Options`}:`,
  'Examples:': `${chalk.green`Examples`}:`,
  boolean: `${chalk.blue`boolean`}`,
  count: `${chalk.blue`count`}`,
  string: `${chalk.blue`string`}`,
  array: `${chalk.blue`array`}`,
  required: `${chalk.blue`required`}`,
  'default:': `${chalk.blue`default`}:`,
  'choices:': `${chalk.blue`choices`}:`,
  'aliases:': `${chalk.blue`aliases`}:`,
};

const nxVersion = require('../package.json').version;

async function determinePluginName(
  parsedArgs: CreateNxPluginArguments
): Promise<string> {
  if (parsedArgs.pluginName) {
    return parsedArgs.pluginName;
  }

  const results = await enquirer.prompt<{ pluginName: string }>([
    {
      name: 'pluginName',
      message: `Plugin name                        `,
      type: 'input',
      validate: (s_1) => (s_1.length ? true : 'Plugin name cannot be empty'),
    },
  ]);
  return results.pluginName;
}

async function determineCreatePackageName(
  parsedArgs: CreateNxPluginArguments
): Promise<string> {
  if (parsedArgs.createPackageName) {
    return parsedArgs.createPackageName;
  }

  const results = await enquirer.prompt<{ createPackageName: string }>([
    {
      name: 'createPackageName',
      message: `Create a package which can be used by npx to create a new workspace (Leave blank to not create this package)`,
      type: 'input',
    },
  ]);
  return results.createPackageName;
}

interface CreateNxPluginArguments {
  pluginName: string;
  createPackageName?: string;
  packageManager: PackageManager;
  ci: CI;
  allPrompts: boolean;
  nxCloud: boolean;
}

export const commandsObject: yargs.Argv<CreateNxPluginArguments> = yargs
  .wrap(yargs.terminalWidth())
  .parserConfiguration({
    'strip-dashed': true,
    'dot-notation': true,
  })
  .command(
    // this is the default and only command
    '$0 [name] [options]',
    'Create a new Nx plugin workspace',
    (yargs) =>
      withOptions(
        yargs
          .positional('pluginName', {
            describe: chalk.dim`Plugin name`,
            type: 'string',
            alias: ['name'],
          })
          .option('createPackageName', {
            describe: 'Name of the CLI package to create workspace with plugin',
            type: 'string',
          }),
        withNxCloud,
        withCI,
        withAllPrompts,
        withPackageManager,
        withGitOptions
      ),
    async (argv: yargs.ArgumentsCamelCase<CreateNxPluginArguments>) => {
      await main(argv).catch((error) => {
        const { version } = require('../package.json');
        output.error({
          title: `Something went wrong! v${version}`,
        });
        throw error;
      });
    },
    [normalizeArgsMiddleware]
  )
  .help('help', chalk.dim`Show help`)
  .updateLocale(yargsDecorator)
  .version(
    'version',
    chalk.dim`Show version`,
    nxVersion
  ) as yargs.Argv<CreateNxPluginArguments>;

async function main(parsedArgs: yargs.Arguments<CreateNxPluginArguments>) {
  const populatedArguments: CreateNxPluginArguments & CreateWorkspaceOptions = {
    ...parsedArgs,
    name: parsedArgs.pluginName.includes('/')
      ? parsedArgs.pluginName.split('/')[1]
      : parsedArgs.pluginName,
  };

  output.log({
    title: `Creating an Nx v${nxVersion} plugin.`,
    bodyLines: [
      'To make sure the command works reliably in all environments, and that the preset is applied correctly,',
      `Nx will run "${parsedArgs.packageManager} install" several times. Please wait.`,
    ],
  });

  const workspaceInfo = await createWorkspace(
    `@nx/plugin@${nxVersion}`,
    populatedArguments
  );

  showNxWarning(parsedArgs.pluginName);

  await recordStat({
    nxVersion,
    command: 'create-nx-workspace',
    useCloud: parsedArgs.nxCloud,
    meta: messages.codeOfSelectedPromptMessage('nxCloudCreation'),
  });

  if (parsedArgs.nxCloud && workspaceInfo.nxCloudInfo) {
    printNxCloudSuccessMessage(workspaceInfo.nxCloudInfo);
  }
}

/**
 * This function is used to normalize the arguments passed to the command.
 * It would:
 * - normalize the preset.
 * @param argv user arguments
 */
async function normalizeArgsMiddleware(
  argv: yargs.Arguments<CreateNxPluginArguments>
): Promise<void> {
  try {
    const pluginName = await determinePluginName(argv);
    const createPackageName = await determineCreatePackageName(argv);
    const packageManager = await determinePackageManager(argv);
    const defaultBase = await determineDefaultBase(argv);
    const nxCloud = await determineNxCloud(argv);
    const ci = await determineCI(argv, nxCloud);

    Object.assign(argv, {
      pluginName,
      createPackageName,
      nxCloud,
      packageManager,
      defaultBase,
      ci,
    } as Partial<CreateNxPluginArguments>);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

// Trigger Yargs
commandsObject.argv;
