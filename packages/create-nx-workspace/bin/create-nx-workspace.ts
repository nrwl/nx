import * as enquirer from 'enquirer';
import * as yargs from 'yargs';
import * as chalk from 'chalk';

import { CreateWorkspaceOptions } from '../src/create-workspace-options';
import { createWorkspace } from '../src/create-workspace';
import { isKnownPreset, Preset } from '../src/utils/preset/preset';
import { presetOptions } from '../src/utils/preset/preset-options';
import { output } from '../src/utils/output';
import { nxVersion } from '../src/utils/nx/nx-version';
import { pointToTutorialAndCourse } from '../src/utils/preset/point-to-tutorial-and-course';

import { yargsDecorator } from './decorator';
import { getThirdPartyPreset } from '../src/utils/preset/get-third-party-preset';
import { Framework, frameworkList } from './types/framework-list';
import { Bundler, bundlerList } from './types/bundler-list';
import {
  determineCI,
  determineDefaultBase,
  determineNxCloud,
  determinePackageManager,
} from '../src/internal-utils/prompts';
import {
  withAllPrompts,
  withCI,
  withGitOptions,
  withNxCloud,
  withOptions,
  withPackageManager,
} from '../src/internal-utils/yargs-options';

interface Arguments extends CreateWorkspaceOptions {
  preset: string;
  appName: string;
  style: string;
  framework: Framework;
  standaloneApi: boolean;
  docker: boolean;
  routing: boolean;
  bundler: Bundler;
}

export const commandsObject: yargs.Argv<Arguments> = yargs
  .wrap(yargs.terminalWidth())
  .parserConfiguration({
    'strip-dashed': true,
    'dot-notation': true,
  })
  .command<Arguments>(
    // this is the default and only command
    '$0 [name] [options]',
    'Create a new Nx workspace',
    (yargs) =>
      withOptions(
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
            default: true,
          })
          .option('style', {
            describe: chalk.dim`Style option to be used when a preset with pregenerated app is selected`,
            type: 'string',
          })
          .option('standaloneApi', {
            describe: chalk.dim`Use Standalone Components if generating an Angular app`,
            type: 'boolean',
          })
          .option('routing', {
            describe: chalk.dim`Add a routing setup when a preset with pregenerated app is selected`,
            type: 'boolean',
          })
          .option('bundler', {
            describe: chalk.dim`Bundler to be used to build the application`,
            choices: bundlerList,
            type: 'string',
          })
          .option('framework', {
            describe: chalk.dim`Framework option to be used when the node-server preset is selected`,
            choices: frameworkList,
            type: 'string',
          })
          .option('docker', {
            describe: chalk.dim`Generate a Dockerfile with your node-server`,
            type: 'boolean',
          }),
        withNxCloud,
        withCI,
        withAllPrompts,
        withPackageManager,
        withGitOptions
      ),

    async (argv: yargs.ArgumentsCamelCase<Arguments>) => {
      await main(argv).catch((error) => {
        const { version } = require('../package.json');
        output.error({
          title: `Something went wrong! v${version}`,
        });
        throw error;
      });
    },
    [normalizeArgsMiddleware as yargs.MiddlewareFunction<{}>]
  )
  .help('help', chalk.dim`Show help`)
  .updateLocale(yargsDecorator)
  .version(
    'version',
    chalk.dim`Show version`,
    nxVersion
  ) as yargs.Argv<Arguments>;

async function main(parsedArgs: yargs.Arguments<Arguments>) {
  await createWorkspace<Arguments>(parsedArgs.preset, parsedArgs);

  if (isKnownPreset(parsedArgs.preset)) {
    pointToTutorialAndCourse(parsedArgs.preset as Preset);
  }
}

/**
 * This function is used to normalize the arguments passed to the command.
 * It would:
 * - normalize the preset.
 * @param argv user arguments
 */
async function normalizeArgsMiddleware(
  argv: yargs.Arguments<Arguments>
): Promise<void> {
  try {
    let name,
      appName,
      style,
      preset,
      framework,
      bundler,
      docker,
      routing,
      standaloneApi;

    output.log({
      title:
        "Let's create a new workspace [https://nx.dev/getting-started/intro]",
    });

    let thirdPartyPreset: string | null;
    try {
      thirdPartyPreset = await getThirdPartyPreset(argv.preset);
    } catch (e) {
      output.error({
        title: `Could not find preset "${argv.preset}"`,
      });
      process.exit(1);
    }

    if (thirdPartyPreset) {
      preset = thirdPartyPreset;
      name = await determineRepoName(argv);
      appName = '';
      style = null;
    } else {
      if (!argv.preset) {
        const monorepoStyle = await determineMonorepoStyle();
        if (monorepoStyle === 'package-based') {
          preset = 'npm';
        } else if (monorepoStyle === 'react') {
          preset = Preset.ReactStandalone;
        } else if (monorepoStyle === 'angular') {
          preset = Preset.AngularStandalone;
        } else if (monorepoStyle === 'node-standalone') {
          preset = Preset.NodeStandalone;
        } else {
          preset = await determinePreset(argv);
        }
      } else if (argv.preset === 'react') {
        preset = await monorepoOrStandalone('react');
      } else if (argv.preset === 'angular') {
        preset = await monorepoOrStandalone('angular');
      } else {
        preset = argv.preset;
      }

      if (
        preset === Preset.ReactStandalone ||
        preset === Preset.AngularStandalone ||
        preset === Preset.NodeStandalone
      ) {
        appName =
          argv.appName ?? argv.name ?? (await determineAppName(preset, argv));
        name = argv.name ?? appName;

        if (preset === Preset.NodeStandalone) {
          framework = await determineFramework(argv);
          if (framework !== 'none') {
            docker = await determineDockerfile(argv);
          }
        }

        if (preset === Preset.ReactStandalone) {
          bundler = await determineBundler(argv);
        }

        if (preset === Preset.AngularStandalone) {
          standaloneApi =
            argv.standaloneApi ??
            (argv.interactive ? await determineStandaloneApi(argv) : false);
          routing =
            argv.routing ??
            (argv.interactive ? await determineRouting(argv) : true);
        }
      } else {
        name = await determineRepoName(argv);
        appName = await determineAppName(preset as Preset, argv);
        if (preset === Preset.ReactMonorepo) {
          bundler = await determineBundler(argv);
        }

        if (preset === Preset.AngularMonorepo) {
          standaloneApi =
            argv.standaloneApi ??
            (argv.interactive ? await determineStandaloneApi(argv) : false);
          routing =
            argv.routing ??
            (argv.interactive ? await determineRouting(argv) : true);
        }
      }
      style = await determineStyle(preset as Preset, argv);
    }

    const packageManager = await determinePackageManager(argv);
    const defaultBase = await determineDefaultBase(argv);
    const nxCloud = await determineNxCloud(argv);
    const ci = await determineCI(argv, nxCloud);

    Object.assign(argv, {
      name,
      preset,
      appName,
      style,
      standaloneApi,
      routing,
      framework,
      nxCloud,
      packageManager,
      defaultBase,
      ci,
      bundler,
      docker,
    });
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

async function determineRepoName(
  parsedArgs: yargs.Arguments<Arguments>
): Promise<string> {
  const repoName: string = parsedArgs._[0]
    ? parsedArgs._[0].toString()
    : parsedArgs.name;

  if (repoName) {
    return Promise.resolve(repoName);
  }

  const a = await enquirer.prompt<{ RepoName: string }>([
    {
      name: 'RepoName',
      message: `Repository name                      `,
      type: 'input',
    },
  ]);
  if (!a.RepoName) {
    output.error({
      title: 'Invalid repository name',
      bodyLines: [`Repository name cannot be empty`],
    });
    process.exit(1);
  }
  return a.RepoName;
}

async function monorepoOrStandalone(preset: string): Promise<string> {
  const a = await enquirer.prompt<{ MonorepoOrStandalone: string }>([
    {
      name: 'MonorepoOrStandalone',
      message: `--preset=${preset} has been replaced with the following:`,
      type: 'autocomplete',
      choices: [
        {
          name: preset + '-standalone',
          message: `${preset}-standalone: a standalone ${preset} application.`,
        },
        {
          name: preset + '-monorepo',
          message: `${preset}-monorepo:   a monorepo with the apps and libs folders.`,
        },
      ],
    },
  ]);
  if (!a.MonorepoOrStandalone) {
    output.error({
      title: 'Invalid selection',
    });
    process.exit(1);
  }
  return a.MonorepoOrStandalone;
}

async function determineMonorepoStyle(): Promise<string> {
  const a = await enquirer.prompt<{ MonorepoStyle: string }>([
    {
      name: 'MonorepoStyle',
      message: `Choose what to create                `,
      type: 'autocomplete',
      choices: [
        {
          name: 'package-based',
          message:
            'Package-based monorepo: Nx makes it fast, but lets you run things your way.',
        },
        {
          name: 'integrated',
          message:
            'Integrated monorepo:    Nx configures your favorite frameworks and lets you focus on shipping features.',
        },
        {
          name: 'react',
          message:
            'Standalone React app:   Nx configures Vite (or Webpack), ESLint, and Cypress.',
        },
        {
          name: 'angular',
          message:
            'Standalone Angular app: Nx configures Jest, ESLint and Cypress.',
        },
        {
          name: 'node-standalone',
          message:
            'Standalone Node app:    Nx configures a framework (ex. Express), esbuild, ESlint and Jest.',
        },
      ],
    },
  ]);
  if (!a.MonorepoStyle) {
    output.error({
      title: 'Invalid monorepo style',
    });
    process.exit(1);
  }
  return a.MonorepoStyle;
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
    .prompt<{ preset: Preset }>([
      {
        name: 'preset',
        message: `What to create in the new workspace  `,
        initial: 'empty' as any,
        type: 'autocomplete',
        choices: presetOptions,
      },
    ])
    .then((a: { preset: Preset }) => a.preset);
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
    .prompt<{ AppName: string }>([
      {
        name: 'AppName',
        message: `Application name                     `,
        type: 'input',
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

async function determineFramework(
  parsedArgs: yargs.Arguments<Arguments>
): Promise<string> {
  const frameworkChoices = [
    {
      name: 'express',
      message: 'Express [https://expressjs.com/]',
    },
    {
      name: 'fastify',
      message: 'Fastify [https://www.fastify.io/]',
    },
    {
      name: 'koa',
      message: 'Koa     [https://koajs.com/]',
    },
    {
      name: 'nest',
      message: 'NestJs  [https://nestjs.com/]',
    },
    {
      name: 'none',
      message: 'None',
    },
  ];

  if (!parsedArgs.framework) {
    return enquirer
      .prompt<{ framework: Framework }>([
        {
          message: 'What framework should be used?',
          type: 'autocomplete',
          name: 'framework',
          choices: frameworkChoices,
        },
      ])
      .then((a) => a.framework);
  }

  const foundFramework = frameworkChoices
    .map(({ name }) => name)
    .indexOf(parsedArgs.framework);

  if (foundFramework < 0) {
    output.error({
      title: 'Invalid framework',
      bodyLines: [
        `It must be one of the following:`,
        '',
        ...frameworkChoices.map(({ name }) => name),
      ],
    });

    process.exit(1);
  }

  return Promise.resolve(parsedArgs.framework);
}

async function determineStandaloneApi(
  parsedArgs: yargs.Arguments<Arguments>
): Promise<boolean> {
  if (parsedArgs.standaloneApi === undefined) {
    return enquirer
      .prompt<{ standaloneApi: 'Yes' | 'No' }>([
        {
          name: 'standaloneApi',
          message:
            'Would you like to use Standalone Components in your application?',
          type: 'autocomplete',
          choices: [
            {
              name: 'Yes',
            },

            {
              name: 'No',
            },
          ],
          initial: 'No' as any,
        },
      ])
      .then((a) => a.standaloneApi === 'Yes');
  }

  return parsedArgs.standaloneApi;
}

async function determineDockerfile(
  parsedArgs: yargs.Arguments<Arguments>
): Promise<boolean> {
  if (parsedArgs.docker === undefined) {
    return enquirer
      .prompt<{ docker: 'Yes' | 'No' }>([
        {
          name: 'docker',
          message:
            'Would you like to generate a Dockerfile? [https://docs.docker.com/]',
          type: 'autocomplete',
          choices: [
            {
              name: 'Yes',
              hint: 'I want to generate a Dockerfile',
            },
            {
              name: 'No',
            },
          ],
          initial: 'No' as any,
        },
      ])
      .then((a) => a.docker === 'Yes');
  } else {
    return Promise.resolve(parsedArgs.docker);
  }
}

async function determineStyle(
  preset: Preset,
  parsedArgs: yargs.Arguments<Arguments>
): Promise<string | null> {
  if (
    preset === Preset.Apps ||
    preset === Preset.Core ||
    preset === Preset.TS ||
    preset === Preset.Empty ||
    preset === Preset.NPM ||
    preset === Preset.Nest ||
    preset === Preset.Express ||
    preset === Preset.ReactNative ||
    preset === Preset.Expo ||
    preset === Preset.NodeStandalone
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

  if (
    [Preset.ReactMonorepo, Preset.ReactStandalone, Preset.NextJs].includes(
      preset
    )
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
      .prompt<{ style: string }>([
        {
          name: 'style',
          message: `Default stylesheet format            `,
          initial: 'css' as any,
          type: 'autocomplete',
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

async function determineRouting(
  parsedArgs: yargs.Arguments<Arguments>
): Promise<boolean> {
  if (!parsedArgs.routing) {
    return enquirer
      .prompt<{ routing: 'Yes' | 'No' }>([
        {
          name: 'routing',
          message: 'Would you like to add routing?',
          type: 'autocomplete',
          choices: [
            {
              name: 'Yes',
            },

            {
              name: 'No',
            },
          ],
          initial: 'Yes' as any,
        },
      ])
      .then((a) => a.routing === 'Yes');
  }

  return parsedArgs.routing;
}

async function determineBundler(
  parsedArgs: yargs.Arguments<Arguments>
): Promise<Bundler> {
  const choices = [
    {
      name: 'vite',
      message: 'Vite    [ https://vitejs.dev/ ]',
    },
    {
      name: 'webpack',
      message: 'Webpack [ https://webpack.js.org/ ]',
    },
  ];

  if (!parsedArgs.bundler) {
    return enquirer
      .prompt<{ bundler: Bundler }>([
        {
          name: 'bundler',
          message: `Bundler to be used to build the application`,
          initial: 'vite' as any,
          type: 'autocomplete',
          choices: choices,
        },
      ])
      .then((a) => a.bundler);
  }

  const foundBundler = choices.find(
    (choice) => choice.name === parsedArgs.bundler
  );

  if (foundBundler === undefined) {
    output.error({
      title: 'Invalid bundler',
      bodyLines: [
        `It must be one of the following:`,
        '',
        ...choices.map((choice) => choice.name),
      ],
    });

    process.exit(1);
  }

  return Promise.resolve(parsedArgs.bundler);
}
