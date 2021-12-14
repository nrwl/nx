#!/usr/bin/env node

import { exec } from 'child_process';
import { writeFileSync } from 'fs';
import * as enquirer from 'enquirer';
import * as path from 'path';
import { dirSync } from 'tmp';
import * as yargsParser from 'yargs-parser';
import { showNxWarning, unparse } from './shared';
import { output } from './output';
import * as ora from 'ora';

import {
  detectInvokedPackageManager,
  getPackageManagerCommand,
  getPackageManagerVersion,
  PackageManager,
} from './package-manager';
import { validateNpmPackage } from './validate-npm-package';

export enum Preset {
  Empty = 'empty',
  NPM = 'npm',
  WebComponents = 'web-components',
  Angular = 'angular',
  AngularWithNest = 'angular-nest',
  React = 'react',
  ReactWithExpress = 'react-express',
  ReactNative = 'react-native',
  NextJs = 'next',
  Gatsby = 'gatsby',
  Nest = 'nest',
  Express = 'express',
}

const presetOptions: { name: Preset; message: string }[] = [
  {
    name: Preset.Empty,
    message:
      'empty             [an empty workspace with a layout that works best for building apps]',
  },
  {
    name: Preset.NPM,
    message:
      'npm               [an empty workspace set up to publish npm packages (similar to and compatible with yarn workspaces)]',
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
    name: Preset.Gatsby,
    message: 'gatsby            [a workspace with a single Gatsby application]',
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

const tsVersion = 'TYPESCRIPT_VERSION';
const cliVersion = 'NX_VERSION';
const nxVersion = 'NX_VERSION';
const prettierVersion = 'PRETTIER_VERSION';

const parsedArgs: any = yargsParser(process.argv.slice(2), {
  string: [
    'name',
    'cli',
    'preset',
    'appName',
    'style',
    'defaultBase',
    'packageManager',
  ],
  alias: {
    packageManager: 'pm',
  },
  boolean: ['help', 'interactive', 'nxCloud'],
  default: {
    interactive: false,
  },
  configuration: {
    'strip-dashed': true,
    'strip-aliased': true,
  },
}) as any;

if (parsedArgs.help) {
  showHelp();
  process.exit(0);
}

(async function main() {
  const packageManager: PackageManager =
    parsedArgs.packageManager || detectInvokedPackageManager();

  const { name, cli, preset, appName, style, nxCloud } = await getConfiguration(
    parsedArgs
  );

  output.log({
    title: `Nx is creating your v${cliVersion} workspace.`,
    bodyLines: [
      'To make sure the command works reliably in all environments, and that the preset is applied correctly,',
      `Nx will run "${packageManager} install" several times. Please wait.`,
    ],
  });

  const tmpDir = await createSandbox(packageManager);

  await createApp(tmpDir, name, packageManager, {
    ...parsedArgs,
    cli,
    preset,
    appName,
    style,
    nxCloud,
  });

  let nxCloudInstallRes;
  if (nxCloud) {
    nxCloudInstallRes = await setupNxCloud(name, packageManager);
  }

  showNxWarning(name);
  pointToTutorialAndCourse(preset);

  if (nxCloud && nxCloudInstallRes.code === 0) {
    printNxCloudSuccessMessage(nxCloudInstallRes.stdout);
  }
})().catch((error) => {
  const { version } = require('../package.json');
  output.error({
    title: `Something went wrong! v${version}`,
  });
  throw error;
});

function showHelp() {
  const options = Object.values(Preset)
    .map((preset) => `"${preset}"`)
    .join(', ');

  console.log(`
  Usage: create-nx-workspace <name> [options] [new workspace options]

  Create a new Nx workspace

  Options:

    name                      Workspace name (e.g., org name)

    preset                    What to create in a new workspace (options: ${options})

    appName                   The name of the application created by some presets

    cli                       CLI to power the Nx workspace (options: "nx", "angular")

    style                     Default style option to be used when a non-empty preset is selected
                              options: ("css", "scss", "less") plus ("styl") for all non-Angular and ("styled-components", "@emotion/styled", "styled-jsx") for React, Next.js, Gatsby

    interactive               Enable interactive mode when using presets (boolean)

    packageManager            Package manager to use (npm, yarn, pnpm)

    nx-cloud                  Use Nx Cloud (boolean)

    [new workspace options]   any 'new workspace' options
`);
}

async function getConfiguration(parsedArgs) {
  try {
    let style, appName;

    const name = await determineWorkspaceName(parsedArgs);
    let preset = await determineThirdPartyPackage(parsedArgs);

    if (!preset) {
      preset = await determinePreset(parsedArgs);
      appName = await determineAppName(preset, parsedArgs);
      style = await determineStyle(preset, parsedArgs);
    }

    const cli = await determineCli(preset, parsedArgs);
    const nxCloud = await askAboutNxCloud(parsedArgs);

    return {
      name,
      preset,
      appName,
      style,
      cli,
      nxCloud,
    };
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

function determineWorkspaceName(parsedArgs: any): Promise<string> {
  const workspaceName: string = parsedArgs._[0]
    ? parsedArgs._[0]
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

async function determineThirdPartyPackage({ preset }) {
  if (preset && Object.values(Preset).indexOf(preset) === -1) {
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

function determinePreset(parsedArgs: any): Promise<Preset> {
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

function determineAppName(preset: Preset, parsedArgs: any): Promise<string> {
  if (preset === Preset.Empty || preset === Preset.NPM) {
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

function determineCli(
  preset: Preset,
  parsedArgs: any
): Promise<'nx' | 'angular'> {
  if (parsedArgs.cli) {
    if (['nx', 'angular'].indexOf(parsedArgs.cli) === -1) {
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

function determineStyle(preset: Preset, parsedArgs: any) {
  if (
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

  if (
    [
      Preset.ReactWithExpress,
      Preset.React,
      Preset.NextJs,
      Preset.Gatsby,
    ].includes(preset)
  ) {
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

async function createSandbox(packageManager: string) {
  const installSpinner = ora(
    `Installing dependencies with ${packageManager}`
  ).start();

  const tmpDir = dirSync().name;
  try {
    writeFileSync(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({
        dependencies: {
          '@nrwl/workspace': nxVersion,
          '@nrwl/tao': cliVersion,
          typescript: tsVersion,
          prettier: prettierVersion,
        },
        license: 'MIT',
      })
    );

    await execAndWait(`${packageManager} install --silent`, tmpDir);

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

  const command = `new ${name} ${args} --collection=@nrwl/workspace`;

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
  const fullCommandWithoutWorkspaceRoot = `${pmc.exec} tao ${command}/generators.json --cli=${cli}`;

  let workspaceSetupSpinner = ora('Creating your workspace').start();

  try {
    const fullCommand = `${fullCommandWithoutWorkspaceRoot} --nxWorkspaceRoot=${nxWorkspaceRoot}`;
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
      `${pmc.exec} nx g @nrwl/nx-cloud:init --no-analytics`,
      path.join(process.cwd(), name)
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
  if (error.logMessage.split('\n').filter((line) => !!line).length === 1) {
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

async function askAboutNxCloud(parsedArgs: any) {
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
          initial: 'No' as any,
        },
      ])
      .then((a: { NxCloud: 'Yes' | 'No' }) => a.NxCloud === 'Yes');
  } else {
    return parsedArgs.nxCloud;
  }
}

function pointToTutorialAndCourse(preset: Preset) {
  const title = `First time using Nx? Check out this interactive Nx tutorial.`;
  switch (preset) {
    case Preset.React:
    case Preset.ReactWithExpress:
    case Preset.NextJs:
    case Preset.Gatsby:
      output.addVerticalSeparator();
      output.note({
        title,
        bodyLines: [
          `https://nx.dev/latest/react/tutorial/01-create-application`,
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
          `https://nx.dev/latest/angular/tutorial/01-create-application`,
          ...pointToFreeCourseOnYoutube(),
        ],
      });
      break;
    case Preset.Nest:
      output.addVerticalSeparator();
      output.note({
        title,
        bodyLines: [
          `https://nx.dev/latest/node/tutorial/01-create-application`,
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
