import { exec } from 'child_process';
import { writeFileSync } from 'fs';
import * as enquirer from 'enquirer';
import * as path from 'path';
import { dirSync } from 'tmp';
import * as yargs from 'yargs';
import { showNxWarning, unparse } from './shared';
import { output } from './output';
import * as ora from 'ora';
import {
  detectInvokedPackageManager,
  getPackageManagerCommand,
  getPackageManagerVersion,
  PackageManager,
  packageManagerList,
} from './package-manager';
import { validateNpmPackage } from './validate-npm-package';
import { deduceDefaultBase } from './default-base';
import { getFileName, stringifyCollection } from './utils';
import { yargsDecorator } from './decorator';
import chalk = require('chalk');
import { ciList } from './ci';

type Arguments = {
  name: string;
  preset: string;
  appName: string;
  cli: string;
  style: string;
  nxCloud: boolean;
  allPrompts: boolean;
  packageManager: PackageManager;
  defaultBase: string;
  ci: string;
};

enum Preset {
  Apps = 'apps',
  Empty = 'empty', // same as apps, deprecated
  Core = 'core', // same as npm, deprecated
  NPM = 'npm',
  TS = 'ts',
  WebComponents = 'web-components',
  Angular = 'angular',
  AngularWithNest = 'angular-nest',
  React = 'react',
  ReactWithExpress = 'react-express',
  ReactNative = 'react-native',
  NextJs = 'next',
  Nest = 'nest',
  Express = 'express',
}

const presetOptions: { name: Preset; message: string }[] = [
  {
    name: Preset.Apps,
    message:
      'apps              [an empty workspace with no plugins with a layout that works best for building apps]',
  },
  {
    name: Preset.NPM,
    message:
      'npm               [an empty workspace with no plugins set up to publish npm packages (similar to yarn workspaces)]',
  },
  {
    name: Preset.TS,
    message:
      'ts                [an empty workspace with the JS/TS plugin preinstalled]',
  },
  {
    name: Preset.React,
    message: 'react             [a workspace with a single React application]',
  },
  {
    name: Preset.Angular,
    message:
      'angular           [a workspace with a single Angular application]',
  },
  {
    name: Preset.NextJs,
    message:
      'next.js           [a workspace with a single Next.js application]',
  },
  {
    name: Preset.Nest,
    message: 'nest              [a workspace with a single Nest application]',
  },
  {
    name: Preset.Express,
    message:
      'express           [a workspace with a single Express application]',
  },
  {
    name: Preset.WebComponents,
    message:
      'web components    [a workspace with a single app built using web components]',
  },
  {
    name: Preset.ReactNative,
    message:
      'react-native      [a workspace with a single React Native application]',
  },
  {
    name: Preset.ReactWithExpress,
    message:
      'react-express     [a workspace with a full stack application (React + Express)]',
  },
  {
    name: Preset.AngularWithNest,
    message:
      'angular-nest      [a workspace with a full stack application (Angular + Nest)]',
  },
];

const nxVersion = require('../package.json').version;
const tsVersion = 'TYPESCRIPT_VERSION'; // This gets replaced with the typescript version in the root package.json during build
const prettierVersion = 'PRETTIER_VERSION'; // This gets replaced with the prettier version in the root package.json during build

export const commandsObject: yargs.Argv<Arguments> = yargs
  .wrap(yargs.terminalWidth())
  .parserConfiguration({
    'strip-dashed': true,
    'dot-notation': false,
  })
  .command(
    // this is the default and only command
    '$0 [name] [options]',
    'Create a new Nx workspace',
    (yargs) =>
      yargs
        .option('name', {
          describe: chalk.dim`Workspace name (e.g. org name)`,
          type: 'string',
        })
        .option('preset', {
          describe: chalk.dim`Customizes the initial content of your workspace. Default presets include: [${Object.values(
            Preset
          )
            .map((p) => `"${p}"`)
            .join(
              ', '
            )}]. To build your own see https://nx.dev/packages/nx-plugin#preset`,
          type: 'string',
        })
        .option('appName', {
          describe: chalk.dim`The name of the application when a preset with pregenerated app is selected`,
          type: 'string',
        })
        .option('interactive', {
          describe: chalk.dim`Enable interactive mode with presets`,
          type: 'boolean',
        })
        .option('cli', {
          describe: chalk.dim`CLI to power the Nx workspace`,
          choices: ['nx', 'angular'],
          type: 'string',
        })
        .option('style', {
          describe: chalk.dim`Style option to be used when a preset with pregenerated app is selected`,
          type: 'string',
        })
        .option('nxCloud', {
          describe: chalk.dim`Use Nx Cloud`,
          type: 'boolean',
        })
        .option('ci', {
          describe: chalk.dim`Generate a CI workflow file`,
          choices: ciList,
          defaultDescription: '',
          type: 'string',
        })
        .option('allPrompts', {
          alias: 'a',
          describe: chalk.dim`Show all prompts`,
          type: 'boolean',
          default: false,
        })
        .option('packageManager', {
          alias: 'pm',
          describe: chalk.dim`Package manager to use`,
          choices: [...packageManagerList].sort(),
          defaultDescription: 'npm',
          type: 'string',
        })
        .option('defaultBase', {
          defaultDescription: 'main',
          describe: chalk.dim`Default base to use for new projects`,
          type: 'string',
        }),
    async (argv: yargs.ArgumentsCamelCase<Arguments>) => {
      await main(argv).catch((error) => {
        const { version } = require('../package.json');
        output.error({
          title: `Something went wrong! v${version}`,
        });
        throw error;
      });
    },
    [getConfiguration]
  )
  .help('help', chalk.dim`Show help`)
  .updateLocale(yargsDecorator)
  .version(
    'version',
    chalk.dim`Show version`,
    nxVersion
  ) as yargs.Argv<Arguments>;

async function main(parsedArgs: yargs.Arguments<Arguments>) {
  const {
    name,
    cli,
    preset,
    appName,
    style,
    nxCloud,
    packageManager,
    defaultBase,
    ci,
  } = parsedArgs;

  output.log({
    title: `Nx is creating your v${nxVersion} workspace.`,
    bodyLines: [
      'To make sure the command works reliably in all environments, and that the preset is applied correctly,',
      `Nx will run "${packageManager} install" several times. Please wait.`,
    ],
  });

  const tmpDir = await createSandbox(packageManager);

  await createApp(tmpDir, name, packageManager as PackageManager, {
    ...parsedArgs,
    cli,
    preset,
    appName,
    style,
    nxCloud,
    defaultBase,
  });

  let nxCloudInstallRes;
  if (nxCloud) {
    nxCloudInstallRes = await setupNxCloud(
      name,
      packageManager as PackageManager
    );
  }
  if (ci) {
    await setupCI(
      name,
      ci,
      packageManager as PackageManager,
      nxCloud && nxCloudInstallRes.code === 0
    );
  }

  showNxWarning(name);
  pointToTutorialAndCourse(preset as Preset);

  if (nxCloud && nxCloudInstallRes.code === 0) {
    printNxCloudSuccessMessage(nxCloudInstallRes.stdout);
  }
}

async function getConfiguration(
  argv: yargs.Arguments<Arguments>
): Promise<void> {
  try {
    let style, appName;

    const name = await determineWorkspaceName(argv);
    let preset = await determineThirdPartyPackage(argv);

    if (!preset) {
      preset = await determinePreset(argv);
      appName = await determineAppName(preset, argv);
      style = await determineStyle(preset, argv);
    }

    const cli = await determineCli(preset, argv);
    const packageManager = await determinePackageManager(argv);
    const defaultBase = await determineDefaultBase(argv);
    const nxCloud = await determineNxCloud(argv);
    const ci = await determineCI(argv, nxCloud);

    Object.assign(argv, {
      name,
      preset,
      appName,
      style,
      cli,
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

function determineWorkspaceName(
  parsedArgs: yargs.Arguments<Arguments>
): Promise<string> {
  const workspaceName: string = parsedArgs._[0]
    ? parsedArgs._[0].toString()
    : parsedArgs.name;

  if (workspaceName) {
    return Promise.resolve(workspaceName);
  }

  return enquirer
    .prompt([
      {
        name: 'WorkspaceName',
        message: `Workspace name (e.g., org name)    `,
        type: 'input',
      },
    ])
    .then((a: { WorkspaceName: string }) => {
      if (!a.WorkspaceName) {
        output.error({
          title: 'Invalid workspace name',
          bodyLines: [`Workspace name cannot be empty`],
        });
        process.exit(1);
      }
      return a.WorkspaceName;
    });
}

async function determinePackageManager(
  parsedArgs: yargs.Arguments<Arguments>
): Promise<PackageManager> {
  const packageManager: string = parsedArgs.packageManager;

  if (packageManager) {
    if (packageManagerList.includes(packageManager as PackageManager)) {
      return Promise.resolve(packageManager as PackageManager);
    }
    output.error({
      title: 'Invalid package manager',
      bodyLines: [
        `Package manager must be one of ${stringifyCollection([
          ...packageManagerList,
        ])}`,
      ],
    });
    process.exit(1);
  }

  if (parsedArgs.allPrompts) {
    return enquirer
      .prompt([
        {
          name: 'PackageManager',
          message: `Which package manager to use       `,
          initial: 'npm' as any,
          type: 'select',
          choices: [
            { name: 'npm', message: 'NPM' },
            { name: 'yarn', message: 'Yarn' },
            { name: 'pnpm', message: 'PNPM' },
          ],
        },
      ])
      .then((a: { PackageManager }) => a.PackageManager);
  }

  return Promise.resolve(detectInvokedPackageManager());
}

async function determineDefaultBase(
  parsedArgs: yargs.Arguments<Arguments>
): Promise<string> {
  if (parsedArgs.defaultBase) {
    return Promise.resolve(parsedArgs.defaultBase);
  }
  if (parsedArgs.allPrompts) {
    return enquirer
      .prompt([
        {
          name: 'DefaultBase',
          message: `Main branch name                   `,
          initial: `main`,
          type: 'input',
        },
      ])
      .then((a: { DefaultBase: string }) => {
        if (!a.DefaultBase) {
          output.error({
            title: 'Invalid branch name',
            bodyLines: [`Branch name cannot be empty`],
          });
          process.exit(1);
        }
        return a.DefaultBase;
      });
  }
  return Promise.resolve(deduceDefaultBase());
}

function isKnownPreset(preset: string): preset is Preset {
  return Object.values(Preset).includes(preset as Preset);
}

async function determineThirdPartyPackage({
  preset,
}: yargs.Arguments<Arguments>) {
  if (preset && !isKnownPreset(preset)) {
    const packageName = preset.match(/.+@/)
      ? preset[0] + preset.substring(1).split('@')[0]
      : preset;
    const validateResult = validateNpmPackage(packageName);
    if (validateResult.validForNewPackages) {
      return Promise.resolve(preset);
    } else {
      //! Error here
      output.error({
        title: 'Invalid preset npm package',
        bodyLines: [
          `There was an error with the preset npm package you provided:`,
          '',
          ...validateResult.errors,
        ],
      });
      process.exit(1);
    }
  } else {
    return Promise.resolve(null);
  }
}

async function determinePreset(parsedArgs: any): Promise<Preset> {
  if (parsedArgs.preset) {
    if (Object.values(Preset).indexOf(parsedArgs.preset) === -1) {
      output.error({
        title: 'Invalid preset',
        bodyLines: [
          `It must be one of the following:`,
          '',
          ...Object.values(Preset),
        ],
      });
      process.exit(1);
    } else {
      return Promise.resolve(parsedArgs.preset);
    }
  }

  return enquirer
    .prompt([
      {
        name: 'Preset',
        message: `What to create in the new workspace`,
        initial: 'empty' as any,
        type: 'select',
        choices: presetOptions,
      },
    ])
    .then((a: { Preset: Preset }) => a.Preset);
}

async function determineAppName(
  preset: Preset,
  parsedArgs: yargs.Arguments<Arguments>
): Promise<string> {
  if (
    preset === Preset.Apps ||
    preset === Preset.Core ||
    preset === Preset.TS ||
    preset === Preset.Empty ||
    preset === Preset.NPM
  ) {
    return Promise.resolve('');
  }

  if (parsedArgs.appName) {
    return Promise.resolve(parsedArgs.appName);
  }

  return enquirer
    .prompt([
      {
        name: 'AppName',
        message: `Application name                   `,
        type: 'input',
      },
    ])
    .then((a: { AppName: string }) => {
      if (!a.AppName) {
        output.error({
          title: 'Invalid name',
          bodyLines: [`Name cannot be empty`],
        });
        process.exit(1);
      }
      return a.AppName;
    });
}

function isValidCli(cli: string): cli is 'angular' | 'nx' {
  return ['nx', 'angular'].indexOf(cli) !== -1;
}

async function determineCli(
  preset: Preset,
  parsedArgs: yargs.Arguments<Arguments>
): Promise<'nx' | 'angular'> {
  if (parsedArgs.cli) {
    if (!isValidCli(parsedArgs.cli)) {
      output.error({
        title: 'Invalid cli',
        bodyLines: [`It must be one of the following:`, '', 'nx', 'angular'],
      });
      process.exit(1);
    }
    return Promise.resolve(parsedArgs.cli);
  }

  switch (preset) {
    case Preset.Angular:
    case Preset.AngularWithNest: {
      return Promise.resolve('angular');
    }
    default: {
      return Promise.resolve('nx');
    }
  }
}

async function determineStyle(
  preset: Preset,
  parsedArgs: yargs.Arguments<Arguments>
): Promise<string> {
  if (
    preset === Preset.Apps ||
    preset === Preset.Core ||
    preset === Preset.TS ||
    preset === Preset.Empty ||
    preset === Preset.NPM ||
    preset === Preset.Nest ||
    preset === Preset.Express ||
    preset === Preset.ReactNative
  ) {
    return Promise.resolve(null);
  }

  const choices = [
    {
      name: 'css',
      message: 'CSS',
    },
    {
      name: 'scss',
      message: 'SASS(.scss)       [ http://sass-lang.com   ]',
    },
    {
      name: 'less',
      message: 'LESS              [ http://lesscss.org     ]',
    },
  ];

  if (![Preset.Angular, Preset.AngularWithNest].includes(preset)) {
    choices.push({
      name: 'styl',
      message: 'Stylus(.styl)     [ http://stylus-lang.com ]',
    });
  }

  if ([Preset.ReactWithExpress, Preset.React, Preset.NextJs].includes(preset)) {
    choices.push(
      {
        name: 'styled-components',
        message:
          'styled-components [ https://styled-components.com            ]',
      },
      {
        name: '@emotion/styled',
        message:
          'emotion           [ https://emotion.sh                       ]',
      },
      {
        name: 'styled-jsx',
        message:
          'styled-jsx        [ https://www.npmjs.com/package/styled-jsx ]',
      }
    );
  }

  if (!parsedArgs.style) {
    return enquirer
      .prompt([
        {
          name: 'style',
          message: `Default stylesheet format          `,
          initial: 'css' as any,
          type: 'select',
          choices: choices,
        },
      ])
      .then((a: { style: string }) => a.style);
  }

  const foundStyle = choices.find((choice) => choice.name === parsedArgs.style);

  if (foundStyle === undefined) {
    output.error({
      title: 'Invalid style',
      bodyLines: [
        `It must be one of the following:`,
        '',
        ...choices.map((choice) => choice.name),
      ],
    });

    process.exit(1);
  }

  return Promise.resolve(parsedArgs.style);
}

async function determineNxCloud(
  parsedArgs: yargs.Arguments<Arguments>
): Promise<boolean> {
  if (parsedArgs.nxCloud === undefined) {
    return enquirer
      .prompt([
        {
          name: 'NxCloud',
          message: `Use Nx Cloud? (It's free and doesn't require registration.)`,
          type: 'select',
          choices: [
            {
              name: 'Yes',
              hint: 'Faster builds, run details, GitHub integration. Learn more at https://nx.app',
            },

            {
              name: 'No',
            },
          ],
          initial: 'Yes' as any,
        },
      ])
      .then((a: { NxCloud: 'Yes' | 'No' }) => a.NxCloud === 'Yes');
  } else {
    return parsedArgs.nxCloud;
  }
}

async function determineCI(
  parsedArgs: yargs.Arguments<Arguments>,
  nxCloud: boolean
): Promise<string> {
  if (!nxCloud) {
    if (parsedArgs.ci) {
      output.warn({
        title: 'Invalid CI value',
        bodyLines: [
          `CI option only works when Nx Cloud is enabled.`,
          `The value provided will be ignored.`,
        ],
      });
    }
    return '';
  }

  if (parsedArgs.ci) {
    return parsedArgs.ci;
  }

  if (parsedArgs.allPrompts) {
    return (
      enquirer
        .prompt([
          {
            name: 'CI',
            message: `CI workflow file to generate?      `,
            type: 'select',
            initial: '' as any,
            choices: [
              { message: 'none', name: '' },
              { message: 'GitHub Actions', name: 'github' },
              { message: 'Circle CI', name: 'circleci' },
              { message: 'Azure DevOps', name: 'azure' },
            ],
          },
        ])
        // enquirer ignores name and value if they are falsy and takes
        // first field that has a truthy value, so wee need to explicitly
        // check for none
        .then((a: { CI: string }) => (a.CI !== 'none' ? a.CI : ''))
    );
  }
  return '';
}

async function createSandbox(packageManager: PackageManager) {
  const installSpinner = ora(
    `Installing dependencies with ${packageManager}`
  ).start();

  const { install } = getPackageManagerCommand(packageManager);

  const tmpDir = dirSync().name;
  try {
    writeFileSync(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({
        dependencies: {
          '@nrwl/workspace': nxVersion,
          nx: nxVersion,
          typescript: tsVersion,
          prettier: prettierVersion,
        },
        license: 'MIT',
      })
    );

    await execAndWait(`${install} --silent --ignore-scripts`, tmpDir);

    installSpinner.succeed();
  } catch (e) {
    installSpinner.fail();
    output.error({
      title: `Nx failed to install dependencies`,
      bodyLines: mapErrorToBodyLines(e),
    });
    process.exit(1);
  } finally {
    installSpinner.stop();
  }

  return tmpDir;
}

async function createApp(
  tmpDir: string,
  name: string,
  packageManager: PackageManager,
  parsedArgs: any
) {
  const { _, cli, ...restArgs } = parsedArgs;

  // Ensure to use packageManager for args
  // if it's not already passed in from previous process
  if (!restArgs.packageManager) {
    restArgs.packageManager = packageManager;
  }

  const args = unparse(restArgs).join(' ');

  const pmc = getPackageManagerCommand(packageManager);

  const command = `new ${name} ${args} --collection=@nrwl/workspace/generators.json --cli=${cli}`;

  let nxWorkspaceRoot = `"${process.cwd().replace(/\\/g, '/')}"`;

  // If path contains spaces there is a problem in Windows for npm@6.
  // In this case we have to escape the wrapping quotes.
  if (
    process.platform === 'win32' &&
    /\s/.test(nxWorkspaceRoot) &&
    packageManager === 'npm'
  ) {
    const pmVersion = +getPackageManagerVersion(packageManager).split('.')[0];
    if (pmVersion < 7) {
      nxWorkspaceRoot = `\\"${nxWorkspaceRoot.slice(1, -1)}\\"`;
    }
  }
  let workspaceSetupSpinner = ora('Creating your workspace').start();

  try {
    const fullCommand = `${pmc.exec} nx ${command} --nxWorkspaceRoot=${nxWorkspaceRoot}`;
    await execAndWait(fullCommand, tmpDir);

    workspaceSetupSpinner.succeed('Nx has successfully created the workspace.');
  } catch (e) {
    workspaceSetupSpinner.fail();
    output.error({
      title: `Nx failed to create a workspace.`,
      bodyLines: mapErrorToBodyLines(e),
    });
    process.exit(1);
  } finally {
    workspaceSetupSpinner.stop();
  }
}

async function setupNxCloud(name: string, packageManager: PackageManager) {
  const nxCloudSpinner = ora(`Setting up NxCloud`).start();
  try {
    const pmc = getPackageManagerCommand(packageManager);
    const res = await execAndWait(
      `${pmc.exec} nx g @nrwl/nx-cloud:init --no-analytics --installationSource=create-nx-workspace`,
      path.join(process.cwd(), getFileName(name))
    );
    nxCloudSpinner.succeed('NxCloud has been set up successfully');
    return res;
  } catch (e) {
    nxCloudSpinner.fail();

    output.error({
      title: `Nx failed to setup NxCloud`,
      bodyLines: mapErrorToBodyLines(e),
    });

    process.exit(1);
  } finally {
    nxCloudSpinner.stop();
  }
}

async function setupCI(
  name: string,
  ci: string,
  packageManager: PackageManager,
  nxCloudSuccessfullyInstalled: boolean
) {
  if (!nxCloudSuccessfullyInstalled) {
    output.error({
      title: `CI workflow generation skipped`,
      bodyLines: [
        `Nx Cloud was not installed`,
        `The autogenerated CI workflow requires Nx Cloud to be set-up.`,
      ],
    });
  }
  const ciSpinner = ora(`Generating CI workflow`).start();
  try {
    const pmc = getPackageManagerCommand(packageManager);
    const res = await execAndWait(
      `${pmc.exec} nx g @nrwl/workspace:ci-workflow --ci=${ci}`,
      path.join(process.cwd(), getFileName(name))
    );
    ciSpinner.succeed('CI workflow has been generated successfully');
    return res;
  } catch (e) {
    ciSpinner.fail();

    output.error({
      title: `Nx failed to generate CI workflow`,
      bodyLines: mapErrorToBodyLines(e),
    });

    process.exit(1);
  } finally {
    ciSpinner.stop();
  }
}

function printNxCloudSuccessMessage(nxCloudOut: string) {
  const bodyLines = nxCloudOut.split('Nx Cloud has been enabled')[1].trim();
  output.note({
    title: `Nx Cloud has been enabled`,
    bodyLines: bodyLines.split('\n').map((r) => r.trim()),
  });
}

function mapErrorToBodyLines(error: {
  logMessage: string;
  code: number;
  logFile: string;
}): string[] {
  if (error.logMessage?.split('\n').filter((line) => !!line).length === 1) {
    // print entire log message only if it's only a single message
    return [`Error: ${error.logMessage}`];
  }
  const lines = [`Exit code: ${error.code}`, `Log file: ${error.logFile}`];
  if (process.env.NX_VERBOSE_LOGGING) {
    lines.push(`Error: ${error.logMessage}`);
  }
  return lines;
}

function execAndWait(command: string, cwd: string) {
  return new Promise((res, rej) => {
    exec(command, { cwd }, (error, stdout, stderr) => {
      if (error) {
        const logFile = path.join(cwd, 'error.log');
        writeFileSync(logFile, `${stdout}\n${stderr}`);
        rej({ code: error.code, logFile, logMessage: stderr });
      } else {
        res({ code: 0, stdout });
      }
    });
  });
}

function pointToTutorialAndCourse(preset: Preset) {
  const title = `First time using Nx? Check out this interactive Nx tutorial.`;
  switch (preset) {
    case Preset.Empty:
    case Preset.NPM:
    case Preset.Apps:
    case Preset.Core:
      output.addVerticalSeparator();
      output.note({
        title,
        bodyLines: [`https://nx.dev/core-tutorial/01-create-blog`],
      });
      break;

    case Preset.TS:
      output.addVerticalSeparator();
      output.note({
        title,
        bodyLines: [`https://nx.dev/getting-started/nx-and-typescript`],
      });
      break;

    case Preset.React:
    case Preset.ReactWithExpress:
    case Preset.NextJs:
      output.addVerticalSeparator();
      output.note({
        title,
        bodyLines: [
          `https://nx.dev/react-tutorial/01-create-application`,
          ...pointToFreeCourseOnEgghead(),
        ],
      });
      break;
    case Preset.Angular:
    case Preset.AngularWithNest:
      output.addVerticalSeparator();
      output.note({
        title,
        bodyLines: [
          `https://nx.dev/angular-tutorial/01-create-application`,
          ...pointToFreeCourseOnYoutube(),
        ],
      });
      break;
    case Preset.Nest:
      output.addVerticalSeparator();
      output.note({
        title,
        bodyLines: [
          `https://nx.dev/node-tutorial/01-create-application`,
          ...pointToFreeCourseOnYoutube(),
        ],
      });
      break;
  }
}

function pointToFreeCourseOnYoutube(): string[] {
  return [
    ``,
    `Prefer watching videos? Check out this free Nx course on YouTube.`,
    `https://www.youtube.com/watch?v=2mYLe9Kp9VM&list=PLakNactNC1dH38AfqmwabvOszDmKriGco`,
  ];
}

function pointToFreeCourseOnEgghead(): string[] {
  return [
    ``,
    `Prefer watching videos? Check out this free Nx course on Egghead.io.`,
    `https://egghead.io/playlists/scale-react-development-with-nx-4038`,
  ];
}
