#!/usr/bin/env node
import * as pc from 'picocolors';
import enquirer = require('enquirer');
import yargs = require('yargs');

import {
  determineDefaultBase,
  determineNxCloud,
  determinePackageManager,
} from 'create-nx-workspace/src/internal-utils/prompts';
import {
  withAllPrompts,
  withGitOptions,
  withNxCloud,
  withOptions,
  withPackageManager,
} from 'create-nx-workspace/src/internal-utils/yargs-options';
import { createWorkspace, CreateWorkspaceOptions } from 'create-nx-workspace';
import { output } from 'create-nx-workspace/src/utils/output';
import { NxCloud } from 'create-nx-workspace/src/utils/nx/nx-cloud';
import type { PackageManager } from 'create-nx-workspace/src/utils/package-manager';
import {
  messages,
  recordStat,
} from 'create-nx-workspace/src/utils/nx/ab-testing';

export const yargsDecorator = {
  'Options:': `${pc.green(`Options`)}:`,
  'Examples:': `${pc.green(`Examples`)}:`,
  boolean: `${pc.blue(`boolean`)}`,
  count: `${pc.blue(`count`)}`,
  string: `${pc.blue(`string`)}`,
  array: `${pc.blue(`array`)}`,
  required: `${pc.blue(`required`)}`,
  'default:': `${pc.blue(`default`)}:`,
  'choices:': `${pc.blue(`choices`)}:`,
  'aliases:': `${pc.blue(`aliases`)}:`,
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
  allPrompts: boolean;
  nxCloud: NxCloud;
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
            describe: pc.dim(`Plugin name`),
            type: 'string',
            alias: ['name'],
          })
          .option('createPackageName', {
            describe: 'Name of the CLI package to create workspace with plugin',
            type: 'string',
          }),
        withNxCloud,
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
  .help('help', pc.dim(`Show help`))
  .updateLocale(yargsDecorator)
  .version(
    'version',
    pc.dim(`Show version`),
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

  await recordStat({
    nxVersion,
    command: 'create-nx-workspace',
    useCloud: parsedArgs.nxCloud !== 'skip',
    meta: [
      messages.codeOfSelectedPromptMessage('setupCI'),
      messages.codeOfSelectedPromptMessage('setupNxCloud'),
    ],
  });

  if (parsedArgs.nxCloud && workspaceInfo.nxCloudInfo) {
    console.log(workspaceInfo.nxCloudInfo);
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

    Object.assign(argv, {
      pluginName,
      createPackageName,
      nxCloud,
      packageManager,
      defaultBase,
    } as Partial<CreateNxPluginArguments>);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

// Trigger Yargs
commandsObject.argv;
