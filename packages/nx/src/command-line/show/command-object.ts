import { CommandModule, showHelp } from 'yargs';
import type { ProjectGraphProjectNode } from '../../config/project-graph';
import { handleErrors } from '../../utils/handle-errors';
import {
  parseCSV,
  withAffectedOptions,
  withVerbose,
} from '../yargs-utils/shared-options';

export interface NxShowArgs {
  json?: boolean;
}

export type ShowProjectsOptions = NxShowArgs & {
  exclude?: string[];
  files?: string;
  uncommitted?: any;
  untracked?: any;
  base?: string;
  head?: string;
  affected?: boolean;
  type?: ProjectGraphProjectNode['type'];
  projects?: string[];
  withTarget?: string[];
  verbose?: boolean;
  sep?: string;
};

export type ShowProjectOptions = NxShowArgs & {
  projectName?: string;
  web?: boolean;
  open?: boolean;
  verbose?: boolean;
};

export type ShowTargetBaseOptions = NxShowArgs & {
  target?: string;
  configuration?: string;
  verbose?: boolean;
};

export type ShowTargetInputsOptions = NxShowArgs & {
  target?: string;
  check?: string[];
  verbose?: boolean;
};

export type ShowTargetOutputsOptions = ShowTargetBaseOptions & {
  check?: string[];
};

export const yargsShowCommand: CommandModule<
  Record<string, unknown>,
  NxShowArgs
> = {
  command: 'show',
  describe: 'Show information about the workspace (e.g., list of projects).',
  builder: (yargs) =>
    yargs
      .command(showProjectsCommand)
      .command(showProjectCommand)
      .command(showTargetCommand)
      .demandCommand()
      .option('json', {
        type: 'boolean',
        description: 'Output JSON.',
      })
      .example(
        '$0 show projects',
        'Show a list of all projects in the workspace'
      )
      .example(
        '$0 show projects --with-target serve',
        'Show a list of all projects in the workspace that have a "serve" target'
      )
      .example(
        '$0 show project [projectName]',
        'Shows the resolved configuration for [projectName]'
      )
      .example(
        '$0 show target my-app:build',
        'Shows resolved configuration for the build target of my-app'
      )
      .example(
        '$0 show target inputs my-app:build',
        'List resolved input files for the build target'
      )
      .example(
        '$0 show target outputs my-app:build',
        'List resolved output paths for the build target'
      ),
  handler: async (args) => {
    showHelp();
    process.exit(1);
  },
};

const showProjectsCommand: CommandModule<NxShowArgs, ShowProjectsOptions> = {
  command: 'projects',
  describe: 'Show a list of projects in the workspace.',
  builder: (yargs) =>
    withVerbose(withAffectedOptions(yargs))
      .option('affected', {
        type: 'boolean',
        description: 'Show only affected projects.',
      })
      .option('projects', {
        type: 'string',
        alias: ['p'],
        description: 'Show only projects that match a given pattern.',
        coerce: parseCSV,
      })
      .option('withTarget', {
        type: 'string',
        alias: ['t'],
        description: 'Show only projects that have a specific target.',
        coerce: parseCSV,
      })
      .option('type', {
        type: 'string',
        description: 'Select only projects of the given type.',
        choices: ['app', 'lib', 'e2e'],
      })
      .option('sep', {
        type: 'string',
        description: 'Outputs projects with the specified seperator.',
      })
      .implies('untracked', 'affected')
      .implies('uncommitted', 'affected')
      .implies('files', 'affected')
      .implies('base', 'affected')
      .implies('head', 'affected')
      .conflicts('sep', 'json')
      .conflicts('json', 'sep')
      .example(
        '$0 show projects --projects "apps/*"',
        'Show all projects in the apps directory'
      )
      .example(
        '$0 show projects --projects "shared-*"',
        'Show all projects that start with "shared-"'
      )
      .example(
        '$0 show projects --affected',
        'Show affected projects in the workspace'
      )
      .example(
        '$0 show projects --type app --affected',
        'Show affected apps in the workspace'
      )
      .example(
        '$0 show projects --affected --exclude=*-e2e',
        'Show affected projects in the workspace, excluding end-to-end projects'
      ) as any,
  handler: async (args) => {
    const exitCode = await handleErrors(args.verbose as boolean, async () => {
      const { showProjectsHandler } = await import('./projects');
      await showProjectsHandler(args);
    });
    process.exit(exitCode);
  },
};

const showProjectCommand: CommandModule<NxShowArgs, ShowProjectOptions> = {
  command: 'project [projectName]',
  describe:
    'Shows resolved project configuration for a given project. If run within a project directory and no project name is provided, the project is inferred from the current working directory.',
  builder: (yargs) =>
    withVerbose(yargs)
      .positional('projectName', {
        type: 'string',
        alias: 'p',
        description:
          'The project to show. If not provided, infers the project from the current working directory.',
      })
      .option('web', {
        type: 'boolean',
        description:
          'Show project details in the browser. (default when interactive).',
      })
      .option('open', {
        type: 'boolean',
        description:
          'Set to false to prevent the browser from opening when using --web.',
        implies: 'web',
      })
      .check((argv) => {
        // If TTY is enabled, default to web. Otherwise, default to JSON.
        const alreadySpecified =
          argv.web !== undefined || argv.json !== undefined;
        if (!alreadySpecified) {
          if (process.stdout.isTTY) {
            argv.web = true;
          } else {
            argv.json = true;
          }
        }
        return true;
      })
      .example(
        '$0 show project my-app',
        'View project information for my-app in JSON format'
      )
      .example(
        '$0 show project my-app --web',
        'View project information for my-app in the browser'
      )
      .example(
        '$0 show project',
        'View project information for the project in the current working directory'
      ),
  handler: async (args) => {
    const exitCode = await handleErrors(args.verbose as boolean, async () => {
      const { showProjectHandler } = await import('./project');
      await showProjectHandler(args);
    });
    process.exit(exitCode);
  },
};

const showTargetInfoCommand: CommandModule<NxShowArgs, ShowTargetBaseOptions> =
  {
    command: '$0 [target] [subcommand]',
    describe:
      'Shows resolved target configuration for a given project target. Target can be specified as project:target or just target (infers project from cwd).',
    builder: (yargs) =>
      withVerbose(yargs)
        .positional('target', {
          type: 'string',
          description:
            'The target to inspect, in the format project:target or just target.',
        })
        .positional('subcommand', {
          type: 'string',
          choices: ['inputs', 'outputs'],
          description:
            'Invokes `nx show target inputs/outputs for the specified target.',
        })
        .option('configuration', {
          type: 'string',
          alias: 'c',
          description: 'The configuration to inspect.',
        })
        .option('check', {
          type: 'string',
          array: true,
          description:
            'Checks whether a set of values are or are not an input/output for the target.',
        })
        .implies('check', 'subcommand')
        .conflicts('check', 'json')
        .example(
          '$0 show target my-app:build',
          'Show target configuration for my-app:build'
        )
        .example(
          '$0 show target my-app:build -c production',
          'Show target configuration with production configuration applied'
        ),
    handler: async (args) => {
      const exitCode = await handleErrors(args.verbose as boolean, async () => {
        const {
          showTargetInfoHandler,
          showTargetInputsHandler,
          showTargetOutputsHandler,
        } = await import('./target');
        if (args.subcommand === 'inputs') {
          await showTargetInputsHandler(args);
          return;
        } else if (args.subcommand === 'outputs') {
          await showTargetOutputsHandler(args);
          return;
        }
        await showTargetInfoHandler(args);
      });
      process.exit(process.exitCode || exitCode);
    },
  };

const showTargetInputsCommand: CommandModule<
  NxShowArgs,
  ShowTargetInputsOptions
> = {
  command: 'inputs [target]',
  describe: 'List resolved input files for a target.',
  builder: (yargs) =>
    withVerbose(yargs)
      .positional('target', {
        type: 'string',
        description:
          'The target to inspect, in the format project:target or just target.',
      })
      .option('check', {
        type: 'string',
        array: true,
        requiresArg: true,
        description:
          'Check whether a set of values are an input for the target. Accepts a file path, environment variable name, runtime command, or external dependency.',
      })
      .conflicts('check', 'json')
      .example(
        '$0 show target inputs my-app:build',
        'List resolved input files for my-app:build'
      )
      .example(
        '$0 show target inputs my-app:build --check src/main.ts',
        'Check if src/main.ts is an input for my-app:build'
      ),
  handler: async (args) => {
    const exitCode = await handleErrors(args.verbose as boolean, async () => {
      const { showTargetInputsHandler } = await import('./target');
      await showTargetInputsHandler(args);
    });
    process.exit(process.exitCode || exitCode);
  },
};

const showTargetOutputsCommand: CommandModule<
  NxShowArgs,
  ShowTargetOutputsOptions
> = {
  command: 'outputs [target]',
  describe: 'List resolved output paths for a target.',
  builder: (yargs) =>
    withVerbose(yargs)
      .positional('target', {
        type: 'string',
        description:
          'The target to inspect, in the format project:target or just target.',
      })
      .option('configuration', {
        type: 'string',
        alias: 'c',
        description: 'The configuration to inspect.',
      })
      .option('check', {
        type: 'string',
        array: true,
        requiresArg: true,
        description:
          'Check whether a set of files is an output for the target. Accepts a workspace-relative path.',
      })
      .conflicts('check', 'json')
      .example(
        '$0 show target outputs my-app:build',
        'List resolved output paths for my-app:build'
      )
      .example(
        '$0 show target outputs my-app:build --check dist/my-app',
        'Check if dist/my-app is an output of my-app:build'
      ) as any,
  handler: async (args) => {
    const exitCode = await handleErrors(args.verbose as boolean, async () => {
      const { showTargetOutputsHandler } = await import('./target');
      await showTargetOutputsHandler(args);
    });
    process.exit(process.exitCode || exitCode);
  },
};

const showTargetCommand: CommandModule<NxShowArgs, ShowTargetBaseOptions> = {
  command: 'target',
  describe:
    'Shows resolved target configuration for a given project target. Use subcommands to inspect inputs or outputs.',
  builder: (yargs) =>
    yargs
      .command(showTargetInputsCommand)
      .command(showTargetOutputsCommand)
      .command(showTargetInfoCommand),
  handler: async () => {
    showHelp();
    process.exit(1);
  },
};
