#!/usr/bin/env node

import { exec, execSync } from 'child_process';
import { writeFileSync } from 'fs';
import * as inquirer from 'inquirer';
import * as path from 'path';
import { dirSync } from 'tmp';
import * as yargsParser from 'yargs-parser';
import { showNxWarning, unparse } from './shared';
import { output } from './output';
import * as ora from 'ora';

import {
  getPackageManagerCommand,
  getPackageManagerVersion,
} from './package-manager';

export enum Preset {
  Empty = 'empty',
  OSS = 'oss',
  WebComponents = 'web-components',
  Angular = 'angular',
  AngularWithNest = 'angular-nest',
  React = 'react',
  ReactWithExpress = 'react-express',
  NextJs = 'next',
  Gatsby = 'gatsby',
  Nest = 'nest',
  Express = 'express',
}

const presetOptions: { value: Preset; name: string }[] = [
  {
    value: Preset.Empty,
    name:
      'empty             [an empty workspace with a layout that works best for building apps]',
  },
  {
    value: Preset.React,
    name: 'react             [a workspace with a single React application]',
  },
  {
    value: Preset.Angular,
    name: 'angular           [a workspace with a single Angular application]',
  },
  {
    value: Preset.NextJs,
    name: 'next.js           [a workspace with a single Next.js application]',
  },
  // TODO: Re-enable when gatsby preset is implemented
  // {
  //   value: Preset.Gatsby,
  //   name: 'gatsby            [a workspace with a single Gatsby application]',
  // },
  {
    value: Preset.Nest,
    name: 'nest              [a workspace with a single Nest application]',
  },
  {
    value: Preset.Express,
    name: 'express           [a workspace with a single Express application]',
  },
  {
    value: Preset.WebComponents,
    name:
      'web components    [a workspace with a single app built using web components]',
  },
  {
    value: Preset.ReactWithExpress,
    name:
      'react-express     [a workspace with a full stack application (React + Express)]',
  },
  {
    value: Preset.AngularWithNest,
    name:
      'angular-nest      [a workspace with a full stack application (Angular + Nest)]',
  },
  {
    value: Preset.OSS,
    name:
      'oss               [an empty workspace with a layout that works best for open-source projects]',
  },
];

const tsVersion = 'TYPESCRIPT_VERSION';
const cliVersion = 'NX_VERSION';
const nxVersion = 'NX_VERSION';
const prettierVersion = 'PRETTIER_VERSION';

const parsedArgs: any = yargsParser(process.argv.slice(2), {
  string: [
    'cli',
    'preset',
    'appName',
    'style',
    'linter',
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
const packageManager = parsedArgs.packageManager || 'npm';
determineWorkspaceName(parsedArgs).then((name) => {
  determinePreset(parsedArgs).then((preset) => {
    return determineAppName(preset, parsedArgs).then((appName) => {
      return determineStyle(preset, parsedArgs).then((style) => {
        return determineCli(preset, parsedArgs).then((cli) => {
          return determineLinter(preset, parsedArgs).then((linter) => {
            return askAboutNxCloud(parsedArgs).then((nxCloud) => {
              const tmpDir = createSandbox(packageManager);
              return createApp(tmpDir, name, {
                ...parsedArgs,
                cli,
                preset,
                appName,
                style,
                linter,
                nxCloud,
              }).then(() => {
                showNxWarning(name);
                pointToTutorialAndCourse(preset);
              });
            });
          });
        });
      });
    });
  });
});

function showHelp() {
  const options = Object.values(Preset)
    .map((preset) => '"' + preset + '"')
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
                              options: ("css", "scss", "styl", "less") for React/Next.js also ("styled-components", "@emotion/styled")    
                              
    linter                    Default linter. Options: "eslint", "tslint".

    interactive               Enable interactive mode when using presets (boolean)

    packageManager            Package manager to use (npm, yarn, pnpm)
    
    nx-cloud                  Use Nx Cloud (boolean)

    [new workspace options]   any 'new workspace' options
`);
}

function determineWorkspaceName(parsedArgs: any): Promise<string> {
  const workspaceName: string = parsedArgs._[0];

  if (workspaceName) {
    return Promise.resolve(workspaceName);
  }

  return inquirer
    .prompt([
      {
        name: 'WorkspaceName',
        message: `Workspace name (e.g., org name)    `,
        type: 'string',
      },
    ])
    .then((a) => {
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

  return inquirer
    .prompt([
      {
        name: 'Preset',
        message: `What to create in the new workspace`,
        default: 'empty',
        type: 'list',
        choices: presetOptions,
      },
    ])
    .then((a: { Preset: Preset }) => a.Preset);
}

function determineAppName(preset: Preset, parsedArgs: any): Promise<string> {
  if (preset === Preset.Empty || preset === Preset.OSS) {
    return Promise.resolve('');
  }

  if (parsedArgs.appName) {
    return Promise.resolve(parsedArgs.appName);
  }

  return inquirer
    .prompt([
      {
        name: 'AppName',
        message: `Application name                   `,
        type: 'string',
      },
    ])
    .then((a) => {
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
    preset === Preset.OSS ||
    preset === Preset.Nest ||
    preset === Preset.Express
  ) {
    return Promise.resolve(null);
  }

  const choices = [
    {
      value: 'css',
      name: 'CSS',
    },
    {
      value: 'scss',
      name: 'SASS(.scss)  [ http://sass-lang.com   ]',
    },
    {
      value: 'styl',
      name: 'Stylus(.styl)[ http://stylus-lang.com ]',
    },
    {
      value: 'less',
      name: 'LESS         [ http://lesscss.org     ]',
    },
  ];

  if (
    [
      Preset.ReactWithExpress,
      Preset.React,
      Preset.NextJs,
      // TODO: Re-enable when gatsby preset is implemented
      // Preset.Gatsby,
    ].includes(preset)
  ) {
    choices.push(
      {
        value: 'styled-components',
        name: 'styled-components [ https://styled-components.com            ]',
      },
      {
        value: '@emotion/styled',
        name: 'emotion           [ https://emotion.sh                       ]',
      },
      {
        value: 'styled-jsx',
        name: 'styled-jsx        [ https://www.npmjs.com/package/styled-jsx ]',
      }
    );
  }

  if (!parsedArgs.style) {
    return inquirer
      .prompt([
        {
          name: 'style',
          message: `Default stylesheet format          `,
          default: 'css',
          type: 'list',
          choices,
        },
      ])
      .then((a) => a.style);
  }

  const foundStyle = choices.find(
    (choice) => choice.value === parsedArgs.style
  );

  if (foundStyle === undefined) {
    output.error({
      title: 'Invalid style',
      bodyLines: [
        `It must be one of the following:`,
        '',
        ...choices.map((choice) => choice.value),
      ],
    });

    process.exit(1);
  }

  return Promise.resolve(parsedArgs.style);
}

function determineLinter(preset: Preset, parsedArgs: any) {
  if (!parsedArgs.linter) {
    if (preset === Preset.Angular || preset === Preset.AngularWithNest) {
      return inquirer
        .prompt([
          {
            name: 'linter',
            message: `Default linter                     `,
            default: 'eslint',
            type: 'list',
            choices: [
              {
                value: 'eslint',
                name: 'ESLint [ Modern linting tool ]',
              },
              {
                value: 'tslint',
                name: 'TSLint [ Used by Angular CLI. Deprecated. ]',
              },
            ],
          },
        ])
        .then((a) => a.linter);
    } else {
      return Promise.resolve('eslint');
    }
  } else {
    if (parsedArgs.linter !== 'eslint' && parsedArgs.linter !== 'tslint') {
      output.error({
        title: 'Invalid linter',
        bodyLines: [`It must be one of the following:`, '', 'eslint', 'tslint'],
      });
      process.exit(1);
    } else {
      return Promise.resolve(parsedArgs.linter);
    }
  }
}

function createSandbox(packageManager: string) {
  output.log({
    title: 'Nx is creating your workspace.',
    bodyLines: [
      'To make sure the command works reliably in all environments, and that the preset is applied correctly,',
      `Nx will run "${packageManager} install" several times. Please wait.`,
    ],
  });
  const tmpDir = dirSync().name;
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

  execSync(`${packageManager} install --silent`, {
    cwd: tmpDir,
    stdio: [0, 1, 2],
  });

  return tmpDir;
}

async function createApp(tmpDir: string, name: string, parsedArgs: any) {
  const { _, cli, ...restArgs } = parsedArgs;
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
  const fullCommand = `${pmc.exec} tao ${command}/collection.json --cli=${cli} --nxWorkspaceRoot=${nxWorkspaceRoot}`;
  const spinner = ora('Creating your workspace').start();

  try {
    await execAndWait(fullCommand, tmpDir);
  } catch (e) {
    output.error({
      title:
        'Something went wrong. Rerunning the command with verbose logging.',
    });
    execSync(fullCommand, {
      stdio: [0, 1, 2],
      cwd: tmpDir,
    });
  } finally {
    spinner.stop();
  }

  output.success({
    title: 'Nx has successfully created the workspace.',
  });

  if (parsedArgs.nxCloud) {
    output.addVerticalSeparator();
    execSync(`${pmc.exec} nx g @nrwl/nx-cloud:init --no-analytics`, {
      stdio: [0, 1, 2],
      cwd: path.join(process.cwd(), name),
    });
  }
}

function execAndWait(command: string, cwd: string) {
  return new Promise((res, rej) => {
    exec(command, { cwd }, (error, stdout, stderr) => {
      if (error) {
        rej();
      } else {
        res(null);
      }
    });
  });
}

async function askAboutNxCloud(parsedArgs: any) {
  if (parsedArgs.nxCloud === undefined) {
    return inquirer
      .prompt([
        {
          name: 'NxCloud',
          message: `Use Nx Cloud? (It's free and doesn't require registration.)`,
          type: 'list',
          choices: [
            {
              value: 'yes',
              name:
                'Yes [Faster builds, run details, Github integration. Learn more at https://nx.app]',
            },

            {
              value: 'no',
              name: 'No',
            },
          ],
          default: 'no',
        },
      ])
      .then((a: { NxCloud: 'yes' | 'no' }) => a.NxCloud === 'yes');
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
      // TODO: Re-enable when gatsby preset is implemented
      // case Preset.Gatsby:
      output.addVerticalSeparator();
      output.note({
        title,
        bodyLines: [
          `https://nx.dev/react/tutorial/01-create-application`,
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
          `https://nx.dev/angular/tutorial/01-create-application`,
          ...pointToFreeCourseOnYoutube(),
        ],
      });
      break;
    case Preset.Nest:
      output.addVerticalSeparator();
      output.note({
        title,
        bodyLines: [
          `https://nx.dev/node/tutorial/01-create-application`,
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
