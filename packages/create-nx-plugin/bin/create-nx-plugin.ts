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
import { createWorkspace } from 'create-nx-workspace';
import { output } from 'create-nx-workspace/src/utils/output';
import { CI } from 'create-nx-workspace/src/utils/ci/ci-list';
import { CreateWorkspaceOptions } from 'create-nx-workspace/src/create-workspace-options';
import { PackageManager } from 'create-nx-workspace/src/utils/package-manager';

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

function determinePluginName(parsedArgs: CreateNxPluginArguments) {
  if (parsedArgs.name) {
    return Promise.resolve(parsedArgs.name);
  }

  return enquirer
    .prompt([
      {
        name: 'pluginName',
        message: `Plugin name                        `,
        type: 'input',
        validate: (s) => (s.length ? true : 'Name cannot be empty'),
      },
    ])
    .then((a: { pluginName: string }) => {
      if (!a.pluginName) {
        output.error({
          title: 'Invalid name',
          bodyLines: [`Name cannot be empty`],
        });
        process.exit(1);
      }
      return a.pluginName;
    });
}

interface CreateNxPluginArguments {
  name: string;
  importPath: string;
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
    withOptions(
      (yargs) =>
        yargs.option('name', {
          describe: chalk.dim`Plugin name`,
          type: 'string',
          alias: ['pluginName'],
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
  };
  await createWorkspace<CreateNxPluginArguments>(
    '@nrwl/nx-plugin',
    populatedArguments
  );
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
    const name = await determinePluginName(argv);
    const packageManager = await determinePackageManager(argv);
    const defaultBase = await determineDefaultBase(argv);
    const nxCloud = await determineNxCloud(argv);
    const ci = await determineCI(argv, nxCloud);

    Object.assign(argv, {
      name,
      nxCloud,
      packageManager,
      defaultBase,
      ci,
    });
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}
