import * as enquirer from 'enquirer';
import * as yargs from 'yargs';
import * as chalk from 'chalk';

import { CreateWorkspaceOptions } from '../src/create-workspace-options';
import { createWorkspace } from '../src/create-workspace';
import { isKnownPreset, Preset } from '../src/utils/preset/preset';
import { CLIErrorMessageConfig, output } from '../src/utils/output';
import { nxVersion } from '../src/utils/nx/nx-version';
import { pointToTutorialAndCourse } from '../src/utils/preset/point-to-tutorial-and-course';

import { yargsDecorator } from './decorator';
import { getPackageNameFromThirdPartyPreset } from '../src/utils/preset/get-third-party-preset';
import {
  determineDefaultBase,
  determineIfGitHubWillBeUsed,
  determineNxCloud,
  determinePackageManager,
} from '../src/internal-utils/prompts';
import {
  withAllPrompts,
  withGitOptions,
  withUseGitHub,
  withNxCloud,
  withOptions,
  withPackageManager,
} from '../src/internal-utils/yargs-options';
import { showNxWarning } from '../src/utils/nx/show-nx-warning';
import { printNxCloudSuccessMessage } from '../src/utils/nx/nx-cloud';
import { messages, recordStat } from '../src/utils/nx/ab-testing';
import { mapErrorToBodyLines } from '../src/utils/error-utils';
import { existsSync } from 'fs';

interface BaseArguments extends CreateWorkspaceOptions {
  preset: Preset;
}

interface NoneArguments extends BaseArguments {
  stack: 'none';
  workspaceType: 'package-based' | 'integrated' | 'standalone';
  js: boolean;
  appName: string | undefined;
}

interface ReactArguments extends BaseArguments {
  stack: 'react';
  workspaceType: 'standalone' | 'integrated';
  appName: string;
  framework: 'none' | 'next' | 'remix';
  style: string;
  bundler: 'webpack' | 'vite' | 'rspack';
  nextAppDir: boolean;
  nextSrcDir: boolean;
  e2eTestRunner: 'none' | 'cypress' | 'playwright';
}

interface AngularArguments extends BaseArguments {
  stack: 'angular';
  workspaceType: 'standalone' | 'integrated';
  appName: string;
  style: string;
  routing: boolean;
  standaloneApi: boolean;
  e2eTestRunner: 'none' | 'cypress' | 'playwright';
  bundler: 'webpack' | 'esbuild';
  ssr: boolean;
  prefix: string;
}

interface VueArguments extends BaseArguments {
  stack: 'vue';
  workspaceType: 'standalone' | 'integrated';
  appName: string;
  framework: 'none' | 'nuxt';
  style: string;
  e2eTestRunner: 'none' | 'cypress' | 'playwright';
}

interface NodeArguments extends BaseArguments {
  stack: 'node';
  workspaceType: 'standalone' | 'integrated';
  appName: string;
  framework: 'express' | 'fastify' | 'koa' | 'nest';
  docker: boolean;
}

interface UnknownStackArguments extends BaseArguments {
  stack: 'unknown';
}

type Arguments =
  | NoneArguments
  | ReactArguments
  | AngularArguments
  | VueArguments
  | NodeArguments
  | UnknownStackArguments;

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
              )}]. To build your own see https://nx.dev/extending-nx/recipes/create-preset`,
            type: 'string',
          })
          .option('interactive', {
            describe: chalk.dim`Enable interactive mode with presets`,
            type: 'boolean',
            default: true,
          })
          .option('workspaceType', {
            describe: chalk.dim`The type of workspace to create`,
            choices: ['integrated', 'package-based', 'standalone'],
            type: 'string',
          })
          .option('appName', {
            describe: chalk.dim`The name of the app when using a monorepo with certain stacks`,
            type: 'string',
          })
          .option('style', {
            describe: chalk.dim`Stylesheet type to be used with certain stacks`,
            type: 'string',
          })
          .option('standaloneApi', {
            describe: chalk.dim`Use Standalone Components if generating an Angular app`,
            type: 'boolean',
            default: true,
          })
          .option('routing', {
            describe: chalk.dim`Add a routing setup for an Angular app`,
            type: 'boolean',
            default: true,
          })
          .option('bundler', {
            describe: chalk.dim`Bundler to be used to build the app`,
            type: 'string',
          })
          .option('framework', {
            describe: chalk.dim`Framework option to be used with certain stacks`,
            type: 'string',
          })
          .option('docker', {
            describe: chalk.dim`Generate a Dockerfile for the Node API`,
            type: 'boolean',
          })
          .option('nextAppDir', {
            describe: chalk.dim`Enable the App Router for Next.js`,
            type: 'boolean',
          })
          .option('nextSrcDir', {
            describe: chalk.dim`Generate a 'src/' directory for Next.js`,
            type: 'boolean',
          })
          .option('e2eTestRunner', {
            describe: chalk.dim`Test runner to use for end to end (E2E) tests.`,
            choices: ['playwright', 'cypress', 'none'],
            type: 'string',
          })
          .option('ssr', {
            describe: chalk.dim`Enable Server-Side Rendering (SSR) and Static Site Generation (SSG/Prerendering) for the Angular application`,
            type: 'boolean',
          })
          .option('prefix', {
            describe: chalk.dim`Prefix to use for Angular component and directive selectors.`,
            type: 'string',
          }),
        withNxCloud,
        withUseGitHub,
        withAllPrompts,
        withPackageManager,
        withGitOptions
      ),

    async function handler(argv: yargs.ArgumentsCamelCase<Arguments>) {
      await main(argv).catch((error) => {
        const { version } = require('../package.json');
        output.error({
          title: `Something went wrong! v${version}`,
        });
        throw error;
      });
    },
    [normalizeArgsMiddleware] as yargs.MiddlewareFunction<{}>[]
  )
  .help('help', chalk.dim`Show help`)
  .updateLocale(yargsDecorator)
  .version(
    'version',
    chalk.dim`Show version`,
    nxVersion
  ) as yargs.Argv<Arguments>;

async function main(parsedArgs: yargs.Arguments<Arguments>) {
  output.log({
    title: `Creating your v${nxVersion} workspace.`,
  });

  const workspaceInfo = await createWorkspace<Arguments>(
    parsedArgs.preset,
    parsedArgs
  );

  showNxWarning(parsedArgs.name);

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
    printNxCloudSuccessMessage(workspaceInfo.nxCloudInfo);
  }

  if (isKnownPreset(parsedArgs.preset)) {
    pointToTutorialAndCourse(parsedArgs.preset as Preset);
  } else {
    output.log({
      title: `Successfully applied preset: ${parsedArgs.preset}`,
    });
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
  output.log({
    title:
      "Let's create a new workspace [https://nx.dev/getting-started/intro]",
  });

  try {
    argv.name = await determineFolder(argv);
    if (!argv.preset || isKnownPreset(argv.preset)) {
      argv.stack = await determineStack(argv);
      const presetOptions = await determinePresetOptions(argv);
      Object.assign(argv, presetOptions);
    } else {
      try {
        getPackageNameFromThirdPartyPreset(argv.preset);
      } catch (e) {
        if (e instanceof Error) {
          output.error({
            title: `Could not find preset "${argv.preset}"`,
            bodyLines: mapErrorToBodyLines(e),
          });
        } else {
          console.error(e);
        }
        process.exit(1);
      }
    }

    const packageManager = await determinePackageManager(argv);
    const defaultBase = await determineDefaultBase(argv);
    const nxCloud =
      argv.skipGit === true ? 'skip' : await determineNxCloud(argv);
    const useGitHub =
      nxCloud === 'skip'
        ? undefined
        : nxCloud === 'github' || (await determineIfGitHubWillBeUsed(nxCloud));
    Object.assign(argv, {
      nxCloud,
      useGitHub,
      packageManager,
      defaultBase,
    });
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

function invariant(
  predicate: string | number | boolean,
  message: CLIErrorMessageConfig
): asserts predicate is NonNullable<string | number> | true {
  if (!predicate) {
    output.error(message);
    process.exit(1);
  }
}

async function determineFolder(
  parsedArgs: yargs.Arguments<Arguments>
): Promise<string> {
  const folderName: string = parsedArgs._[0]
    ? parsedArgs._[0].toString()
    : parsedArgs.name;
  if (folderName) return folderName;

  const reply = await enquirer.prompt<{ folderName: string }>([
    {
      name: 'folderName',
      message: `Where would you like to create your workspace?`,
      initial: 'org',
      type: 'input',
    },
  ]);

  invariant(reply.folderName, {
    title: 'Invalid folder name',
    bodyLines: [`Folder name cannot be empty`],
  });

  invariant(!existsSync(reply.folderName), {
    title: 'That folder is already taken',
  });

  return reply.folderName;
}

async function determineStack(
  parsedArgs: yargs.Arguments<Arguments>
): Promise<'none' | 'react' | 'angular' | 'vue' | 'node' | 'unknown'> {
  if (parsedArgs.preset) {
    switch (parsedArgs.preset) {
      case Preset.Angular:
      case Preset.AngularStandalone:
      case Preset.AngularMonorepo:
        return 'angular';
      case Preset.React:
      case Preset.ReactStandalone:
      case Preset.ReactMonorepo:
      case Preset.NextJs:
      case Preset.NextJsStandalone:
      case Preset.RemixStandalone:
      case Preset.RemixMonorepo:
      case Preset.ReactNative:
      case Preset.Expo:
        return 'react';
      case Preset.Vue:
      case Preset.VueStandalone:
      case Preset.VueMonorepo:
      case Preset.Nuxt:
      case Preset.NuxtStandalone:
        return 'vue';
      case Preset.Nest:
      case Preset.NodeStandalone:
      case Preset.Express:
        return 'node';
      case Preset.Apps:
      case Preset.NPM:
      case Preset.TS:
      case Preset.TsStandalone:
        return 'none';
      case Preset.WebComponents:
      default:
        return 'unknown';
    }
  }

  const { stack } = await enquirer.prompt<{
    stack: 'none' | 'react' | 'angular' | 'node' | 'vue';
  }>([
    {
      name: 'stack',
      message: `Which stack do you want to use?`,
      type: 'autocomplete',
      choices: [
        {
          name: `none`,
          message: `None:          Configures a TypeScript/JavaScript project with minimal structure.`,
        },
        {
          name: `react`,
          message: `React:         Configures a React application with your framework of choice.`,
        },
        {
          name: `vue`,
          message: `Vue:           Configures a Vue application with your framework of choice.`,
        },
        {
          name: `angular`,
          message: `Angular:       Configures a Angular application with modern tooling.`,
        },
        {
          name: `node`,
          message: `Node:          Configures a Node API application with your framework of choice.`,
        },
      ],
    },
  ]);

  return stack;
}

async function determinePresetOptions(
  parsedArgs: yargs.Arguments<Arguments>
): Promise<Partial<Arguments>> {
  switch (parsedArgs.stack) {
    case 'none':
      return determineNoneOptions(parsedArgs);
    case 'react':
      return determineReactOptions(parsedArgs);
    case 'angular':
      return determineAngularOptions(parsedArgs);
    case 'vue':
      return determineVueOptions(parsedArgs);
    case 'node':
      return determineNodeOptions(parsedArgs);
    default:
      return parsedArgs;
  }
}

async function determineNoneOptions(
  parsedArgs: yargs.Arguments<NoneArguments>
): Promise<Partial<NoneArguments>> {
  let preset: Preset;
  let workspaceType: 'package-based' | 'standalone' | 'integrated' | undefined =
    undefined;
  let appName: string | undefined = undefined;
  let js: boolean | undefined;

  if (parsedArgs.preset) {
    preset = parsedArgs.preset;
  } else {
    workspaceType = await determinePackageBasedOrIntegratedOrStandalone();
    if (workspaceType === 'standalone') {
      preset = Preset.TsStandalone;
    } else if (workspaceType === 'integrated') {
      preset = Preset.Apps;
    } else {
      preset = Preset.NPM;
    }
  }

  if (parsedArgs.js !== undefined) {
    js = parsedArgs.js;
  } else if (preset === Preset.TsStandalone) {
    // Only standalone TS preset generates a default package, so we need to provide --js and --appName options.
    appName = parsedArgs.name;
    const reply = await enquirer.prompt<{ ts: 'Yes' | 'No' }>([
      {
        name: 'ts',
        message: `Would you like to use TypeScript with this project?`,
        type: 'autocomplete',
        choices: [
          {
            name: 'Yes',
          },
          {
            name: 'No',
          },
        ],
        initial: 0,
      },
    ]);
    js = reply.ts === 'No';
  }

  return { preset, js, appName };
}

async function determineReactOptions(
  parsedArgs: yargs.Arguments<ReactArguments>
): Promise<Partial<Arguments>> {
  let preset: Preset;
  let style: undefined | string = undefined;
  let appName: string;
  let bundler: undefined | 'webpack' | 'vite' | 'rspack' = undefined;
  let e2eTestRunner: undefined | 'none' | 'cypress' | 'playwright' = undefined;
  let nextAppDir = false;
  let nextSrcDir = false;

  if (parsedArgs.preset && parsedArgs.preset !== Preset.React) {
    preset = parsedArgs.preset;
    if (
      preset === Preset.ReactStandalone ||
      preset === Preset.NextJsStandalone ||
      preset === Preset.RemixStandalone
    ) {
      appName = parsedArgs.appName ?? parsedArgs.name;
    } else {
      appName = await determineAppName(parsedArgs);
    }
  } else {
    const framework = await determineReactFramework(parsedArgs);

    // React Native and Expo only support integrated monorepos for now.
    // TODO(jack): Add standalone support for React Native and Expo.
    const workspaceType =
      framework === 'react-native' || framework === 'expo'
        ? 'integrated'
        : await determineStandaloneOrMonorepo();

    if (workspaceType === 'standalone') {
      appName = parsedArgs.name;
    } else {
      appName = await determineAppName(parsedArgs);
    }

    if (framework === 'nextjs') {
      if (workspaceType === 'standalone') {
        preset = Preset.NextJsStandalone;
      } else {
        preset = Preset.NextJs;
      }
    } else if (framework === 'remix') {
      if (workspaceType === 'standalone') {
        preset = Preset.RemixStandalone;
      } else {
        preset = Preset.RemixMonorepo;
      }
    } else if (framework === 'react-native') {
      preset = Preset.ReactNative;
    } else if (framework === 'expo') {
      preset = Preset.Expo;
    } else {
      if (workspaceType === 'standalone') {
        preset = Preset.ReactStandalone;
      } else {
        preset = Preset.ReactMonorepo;
      }
    }
  }

  if (preset === Preset.ReactStandalone || preset === Preset.ReactMonorepo) {
    bundler = await determineReactBundler(parsedArgs);
    e2eTestRunner = await determineE2eTestRunner(parsedArgs);
  } else if (preset === Preset.NextJs || preset === Preset.NextJsStandalone) {
    nextAppDir = await determineNextAppDir(parsedArgs);
    nextSrcDir = await determineNextSrcDir(parsedArgs);
    e2eTestRunner = await determineE2eTestRunner(parsedArgs);
  } else if (
    preset === Preset.RemixMonorepo ||
    preset === Preset.RemixStandalone
  ) {
    e2eTestRunner = await determineE2eTestRunner(parsedArgs);
  }

  if (parsedArgs.style) {
    style = parsedArgs.style;
  } else if (
    preset === Preset.ReactStandalone ||
    preset === Preset.ReactMonorepo ||
    preset === Preset.NextJs ||
    preset === Preset.NextJsStandalone
  ) {
    const reply = await enquirer.prompt<{ style: string }>([
      {
        name: 'style',
        message: `Default stylesheet format`,
        initial: 0,
        type: 'autocomplete',
        choices: [
          {
            name: 'css',
            message: 'CSS',
          },
          {
            name: 'scss',
            message: 'SASS(.scss)       [ https://sass-lang.com   ]',
          },
          {
            name: 'less',
            message: 'LESS              [ https://lesscss.org     ]',
          },
          {
            name: 'tailwind',
            message: 'tailwind          [ https://tailwindcss.com     ]',
          },
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
          },
        ],
      },
    ]);
    style = reply.style;
  }

  return {
    preset,
    style,
    appName,
    bundler,
    nextAppDir,
    nextSrcDir,
    e2eTestRunner,
  };
}

async function determineVueOptions(
  parsedArgs: yargs.Arguments<VueArguments>
): Promise<Partial<Arguments>> {
  let preset: Preset;
  let style: undefined | string = undefined;
  let appName: string;
  let e2eTestRunner: undefined | 'none' | 'cypress' | 'playwright' = undefined;

  if (parsedArgs.preset && parsedArgs.preset !== Preset.Vue) {
    preset = parsedArgs.preset;
    if (preset === Preset.VueStandalone || preset === Preset.NuxtStandalone) {
      appName = parsedArgs.appName ?? parsedArgs.name;
    } else {
      appName = await determineAppName(parsedArgs);
    }
  } else {
    const framework = await determineVueFramework(parsedArgs);

    const workspaceType = await determineStandaloneOrMonorepo();
    if (workspaceType === 'standalone') {
      appName = parsedArgs.appName ?? parsedArgs.name;
    } else {
      appName = await determineAppName(parsedArgs);
    }

    if (framework === 'nuxt') {
      if (workspaceType === 'standalone') {
        preset = Preset.NuxtStandalone;
      } else {
        preset = Preset.Nuxt;
      }
    } else {
      if (workspaceType === 'standalone') {
        preset = Preset.VueStandalone;
      } else {
        preset = Preset.VueMonorepo;
      }
    }
  }

  e2eTestRunner = await determineE2eTestRunner(parsedArgs);

  if (parsedArgs.style) {
    style = parsedArgs.style;
  } else {
    const reply = await enquirer.prompt<{ style: string }>([
      {
        name: 'style',
        message: `Default stylesheet format`,
        initial: 0,
        type: 'autocomplete',
        choices: [
          {
            name: 'css',
            message: 'CSS',
          },
          {
            name: 'scss',
            message: 'SASS(.scss)       [ https://sass-lang.com   ]',
          },
          {
            name: 'less',
            message: 'LESS              [ https://lesscss.org     ]',
          },
          {
            name: 'none',
            message: 'None',
          },
        ],
      },
    ]);
    style = reply.style;
  }

  return { preset, style, appName, e2eTestRunner };
}

async function determineAngularOptions(
  parsedArgs: yargs.Arguments<AngularArguments>
): Promise<Partial<Arguments>> {
  let preset: Preset;
  let style: string;
  let appName: string;
  let e2eTestRunner: undefined | 'none' | 'cypress' | 'playwright' = undefined;
  let bundler: undefined | 'webpack' | 'esbuild' = undefined;
  let ssr: undefined | boolean = undefined;

  const standaloneApi = parsedArgs.standaloneApi;
  const routing = parsedArgs.routing;
  const prefix = parsedArgs.prefix;

  if (prefix) {
    // https://github.com/angular/angular-cli/blob/main/packages/schematics/angular/utility/validation.ts#L11-L14
    const htmlSelectorRegex =
      /^[a-zA-Z][.0-9a-zA-Z]*((:?-[0-9]+)*|(:?-[a-zA-Z][.0-9a-zA-Z]*(:?-[0-9]+)*)*)$/;

    // validate whether component/directive selectors will be valid with the provided prefix
    if (!htmlSelectorRegex.test(`${prefix}-placeholder`)) {
      output.error({
        title: `Failed to create a workspace.`,
        bodyLines: [
          `The provided "${prefix}" prefix is invalid. It must be a valid HTML selector.`,
        ],
      });

      process.exit(1);
    }
  }

  if (parsedArgs.preset && parsedArgs.preset !== Preset.Angular) {
    preset = parsedArgs.preset;

    if (preset === Preset.AngularStandalone) {
      appName = parsedArgs.name;
    } else {
      appName = await determineAppName(parsedArgs);
    }
  } else {
    const workspaceType = await determineStandaloneOrMonorepo();

    if (workspaceType === 'standalone') {
      preset = Preset.AngularStandalone;
      appName = parsedArgs.name;
    } else {
      preset = Preset.AngularMonorepo;
      appName = await determineAppName(parsedArgs);
    }
  }

  if (parsedArgs.bundler) {
    bundler = parsedArgs.bundler;
  } else {
    const reply = await enquirer.prompt<{ bundler: 'esbuild' | 'webpack' }>([
      {
        name: 'bundler',
        message: `Which bundler would you like to use?`,
        type: 'autocomplete',
        choices: [
          {
            name: 'esbuild',
            message: 'esbuild [ https://esbuild.github.io/ ]',
          },
          {
            name: 'webpack',
            message: 'Webpack [ https://webpack.js.org/ ]',
          },
        ],
        initial: 0,
      },
    ]);
    bundler = reply.bundler;
  }

  if (parsedArgs.style) {
    style = parsedArgs.style;
  } else {
    const reply = await enquirer.prompt<{ style: string }>([
      {
        name: 'style',
        message: `Default stylesheet format`,
        initial: 0,
        type: 'autocomplete',
        choices: [
          {
            name: 'css',
            message: 'CSS',
          },
          {
            name: 'scss',
            message: 'SASS(.scss)       [ https://sass-lang.com   ]',
          },
          {
            name: 'less',
            message: 'LESS              [ https://lesscss.org     ]',
          },
        ],
      },
    ]);
    style = reply.style;
  }

  if (parsedArgs.ssr !== undefined) {
    ssr = parsedArgs.ssr;
  } else {
    const reply = await enquirer.prompt<{ ssr: 'Yes' | 'No' }>([
      {
        name: 'ssr',
        message:
          'Do you want to enable Server-Side Rendering (SSR) and Static Site Generation (SSG/Prerendering)?',
        type: 'autocomplete',
        choices: [{ name: 'Yes' }, { name: 'No' }],
        initial: 1,
      },
    ]);
    ssr = reply.ssr === 'Yes';
  }

  e2eTestRunner = await determineE2eTestRunner(parsedArgs);

  return {
    preset,
    style,
    appName,
    standaloneApi,
    routing,
    e2eTestRunner,
    bundler,
    ssr,
    prefix,
  };
}

async function determineNodeOptions(
  parsedArgs: yargs.Arguments<NodeArguments>
): Promise<Partial<Arguments>> {
  let preset: Preset;
  let appName: string;
  let framework: 'express' | 'fastify' | 'koa' | 'nest' | 'none';
  let docker: boolean;

  if (parsedArgs.preset) {
    preset = parsedArgs.preset;

    if (
      preset === Preset.Nest ||
      preset === Preset.Express ||
      preset === Preset.NodeMonorepo
    ) {
      appName = await determineAppName(parsedArgs);
    } else {
      appName = parsedArgs.name;
    }

    if (preset === Preset.NodeStandalone || preset === Preset.NodeMonorepo) {
      framework = await determineNodeFramework(parsedArgs);
    } else {
      framework = 'none';
    }
  } else {
    framework = await determineNodeFramework(parsedArgs);

    const workspaceType = await determineStandaloneOrMonorepo();
    if (workspaceType === 'standalone') {
      preset = Preset.NodeStandalone;
      appName = parsedArgs.name;
    } else {
      preset = Preset.NodeMonorepo;
      appName = await determineAppName(parsedArgs);
    }
  }

  if (parsedArgs.docker !== undefined) {
    docker = parsedArgs.docker;
  } else {
    const reply = await enquirer.prompt<{ docker: 'Yes' | 'No' }>([
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
        initial: 1,
      },
    ]);
    docker = reply.docker === 'Yes';
  }

  return {
    preset,
    appName,
    framework,
    docker,
  };
}

async function determinePackageBasedOrIntegratedOrStandalone(): Promise<
  'package-based' | 'integrated' | 'standalone'
> {
  const { workspaceType } = await enquirer.prompt<{
    workspaceType: 'standalone' | 'integrated' | 'package-based';
  }>([
    {
      type: 'autocomplete',
      name: 'workspaceType',
      message: `Package-based monorepo, integrated monorepo, or standalone project?`,
      initial: 0,
      choices: [
        {
          name: 'package-based',
          message:
            'Package-based Monorepo:     Nx makes it fast, but lets you run things your way.',
        },
        {
          name: 'integrated',
          message:
            'Integrated Monorepo:        Nx creates a monorepo that contains multiple projects.',
        },
        {
          name: 'standalone',
          message:
            'Standalone:                 Nx creates a single project and makes it fast.',
        },
      ],
    },
  ]);

  invariant(workspaceType, {
    title: 'Invalid workspace type',
    bodyLines: [
      `It must be one of the following: standalone, integrated. Got ${workspaceType}`,
    ],
  });

  return workspaceType;
}

async function determineStandaloneOrMonorepo(): Promise<
  'integrated' | 'standalone'
> {
  const { workspaceType } = await enquirer.prompt<{
    workspaceType: 'standalone' | 'integrated';
  }>([
    {
      type: 'autocomplete',
      name: 'workspaceType',
      message: `Integrated monorepo, or standalone project?`,
      initial: 1,
      choices: [
        {
          name: 'integrated',
          message:
            'Integrated Monorepo:  Nx creates a monorepo that contains multiple projects.',
        },
        {
          name: 'standalone',
          message:
            'Standalone:           Nx creates a single project and makes it fast.',
        },
      ],
    },
  ]);

  invariant(workspaceType, {
    title: 'Invalid workspace type',
    bodyLines: [
      `It must be one of the following: standalone, integrated. Got ${workspaceType}`,
    ],
  });

  return workspaceType;
}

async function determineAppName(
  parsedArgs: yargs.Arguments<
    ReactArguments | AngularArguments | NodeArguments | VueArguments
  >
): Promise<string> {
  if (parsedArgs.appName) return parsedArgs.appName;

  const { appName } = await enquirer.prompt<{ appName: string }>([
    {
      name: 'appName',
      message: `Application name`,
      type: 'input',
      initial: parsedArgs.name,
    },
  ]);
  invariant(appName, {
    title: 'Invalid name',
    bodyLines: [`Name cannot be empty`],
  });
  return appName;
}

async function determineReactFramework(
  parsedArgs: yargs.Arguments<ReactArguments>
): Promise<'none' | 'nextjs' | 'remix' | 'expo' | 'react-native'> {
  const reply = await enquirer.prompt<{
    framework: 'none' | 'nextjs' | 'remix' | 'expo' | 'react-native';
  }>([
    {
      name: 'framework',
      message: 'What framework would you like to use?',
      type: 'autocomplete',
      choices: [
        {
          name: 'none',
          message: 'None',
          hint: '         I only want react and react-dom',
        },
        {
          name: 'nextjs',
          message: 'Next.js       [ https://nextjs.org/      ]',
        },
        {
          name: 'remix',
          message: 'Remix         [ https://remix.run/       ]',
        },
        {
          name: 'expo',
          message: 'Expo          [ https://expo.io/         ]',
        },
        {
          name: 'react-native',
          message: 'React Native  [ https://reactnative.dev/ ]',
        },
      ],
      initial: 0,
    },
  ]);
  return reply.framework;
}

async function determineReactBundler(
  parsedArgs: yargs.Arguments<ReactArguments>
): Promise<'webpack' | 'vite' | 'rspack'> {
  if (parsedArgs.bundler) return parsedArgs.bundler;
  const reply = await enquirer.prompt<{
    bundler: 'webpack' | 'vite' | 'rspack';
  }>([
    {
      name: 'bundler',
      message: `Which bundler would you like to use?`,
      type: 'autocomplete',
      choices: [
        {
          name: 'vite',
          message: 'Vite    [ https://vitejs.dev/     ]',
        },
        {
          name: 'webpack',
          message: 'Webpack [ https://webpack.js.org/ ]',
        },
        {
          name: 'rspack',
          message: 'Rspack  [ https://www.rspack.dev/ ]',
        },
      ],
    },
  ]);
  return reply.bundler;
}

async function determineNextAppDir(
  parsedArgs: yargs.Arguments<ReactArguments>
): Promise<boolean> {
  if (parsedArgs.nextAppDir !== undefined) return parsedArgs.nextAppDir;
  const reply = await enquirer.prompt<{ nextAppDir: 'Yes' | 'No' }>([
    {
      name: 'nextAppDir',
      message: 'Would you like to use the App Router (recommended)?',
      type: 'autocomplete',
      choices: [
        {
          name: 'Yes',
        },
        {
          name: 'No',
        },
      ],
      initial: 0,
    },
  ]);
  return reply.nextAppDir === 'Yes';
}

async function determineNextSrcDir(
  parsedArgs: yargs.Arguments<ReactArguments>
): Promise<boolean> {
  if (parsedArgs.nextSrcDir !== undefined) return parsedArgs.nextSrcDir;
  const reply = await enquirer.prompt<{ nextSrcDir: 'Yes' | 'No' }>([
    {
      name: 'nextSrcDir',
      message: 'Would you like to use the src/ directory?',
      type: 'autocomplete',
      choices: [
        {
          name: 'Yes',
        },
        {
          name: 'No',
        },
      ],
      initial: 0,
    },
  ]);
  return reply.nextSrcDir === 'Yes';
}

async function determineVueFramework(
  parsedArgs: yargs.Arguments<VueArguments>
): Promise<'none' | 'nuxt'> {
  if (!!parsedArgs.framework) return parsedArgs.framework;
  const reply = await enquirer.prompt<{
    framework: 'none' | 'nuxt';
  }>([
    {
      name: 'framework',
      message: 'What framework would you like to use?',
      type: 'autocomplete',
      choices: [
        {
          name: 'none',
          message: 'None',
          hint: '         I only want Vue',
        },
        {
          name: 'nuxt',
          message: 'Nuxt          [ https://nuxt.com/ ]',
        },
      ],
      initial: 0,
    },
  ]);
  return reply.framework;
}

async function determineNodeFramework(
  parsedArgs: yargs.Arguments<NodeArguments>
): Promise<'express' | 'fastify' | 'koa' | 'nest' | 'none'> {
  if (parsedArgs.framework) return parsedArgs.framework;
  const reply = await enquirer.prompt<{
    framework: 'express' | 'fastify' | 'koa' | 'nest' | 'none';
  }>([
    {
      message: 'What framework should be used?',
      type: 'autocomplete',
      name: 'framework',
      choices: [
        {
          name: 'none',
          message: 'None',
        },
        {
          name: 'express',
          message: 'Express [ https://expressjs.com/ ]',
        },
        {
          name: 'fastify',
          message: 'Fastify [ https://www.fastify.dev/ ]',
        },
        {
          name: 'koa',
          message: 'Koa     [ https://koajs.com/      ]',
        },
        {
          name: 'nest',
          message: 'NestJs  [ https://nestjs.com/     ]',
        },
      ],
    },
  ]);
  return reply.framework;
}

async function determineE2eTestRunner(
  parsedArgs: yargs.Arguments<{
    e2eTestRunner?: 'none' | 'cypress' | 'playwright';
  }>
): Promise<'none' | 'cypress' | 'playwright'> {
  if (parsedArgs.e2eTestRunner) return parsedArgs.e2eTestRunner;
  const reply = await enquirer.prompt<{
    e2eTestRunner: 'none' | 'cypress' | 'playwright';
  }>([
    {
      message: 'Test runner to use for end to end (E2E) tests',
      type: 'autocomplete',
      name: 'e2eTestRunner',
      choices: [
        {
          name: 'playwright',
          message: 'Playwright [ https://playwright.dev/ ]',
        },
        {
          name: 'cypress',
          message: 'Cypress [ https://www.cypress.io/ ]',
        },
        {
          name: 'none',
          message: 'None',
        },
      ],
    },
  ]);
  return reply.e2eTestRunner;
}
