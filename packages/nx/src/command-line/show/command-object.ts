import type { ProjectGraphProjectNode } from '../../config/project-graph';
import { CommandModule, showHelp } from 'yargs';
import {
  parseCSV,
  withAffectedOptions,
  withVerbose,
} from '../yargs-utils/shared-options';
import { handleErrors } from '../../utils/params';

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
  projectName: string;
  web?: boolean;
  open?: boolean;
  verbose?: boolean;
};

export const yargsShowCommand: CommandModule<
  Record<string, unknown>,
  NxShowArgs
> = {
  command: 'show',
  describe: 'Show information about the workspace (e.g., list of projects)',
  builder: (yargs) =>
    yargs
      .command(showProjectsCommand)
      .command(showProjectCommand)
      .demandCommand()
      .option('json', {
        type: 'boolean',
        description: 'Output JSON',
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
      ),
  handler: async (args) => {
    showHelp();
    process.exit(1);
  },
};

const showProjectsCommand: CommandModule<NxShowArgs, ShowProjectsOptions> = {
  command: 'projects',
  describe: 'Show a list of projects in the workspace',
  builder: (yargs) =>
    withVerbose(withAffectedOptions(yargs))
      .option('affected', {
        type: 'boolean',
        description: 'Show only affected projects',
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
        description: 'Show only projects that have a specific target',
        coerce: parseCSV,
      })
      .option('type', {
        type: 'string',
        description: 'Select only projects of the given type',
        choices: ['app', 'lib', 'e2e'],
      })
      .option('sep', {
        type: 'string',
        description: 'Outputs projects with the specified seperator',
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
    const exitCode = await handleErrors(
      args.verbose ?? process.env.NX_VERBOSE_LOGGING === 'true',
      async () => {
        const { showProjectsHandler } = await import('./projects');
        await showProjectsHandler(args);
      }
    );
    process.exit(exitCode);
  },
};

const showProjectCommand: CommandModule<NxShowArgs, ShowProjectOptions> = {
  command: 'project <projectName>',
  describe: 'Shows resolved project configuration for a given project.',
  builder: (yargs) =>
    withVerbose(yargs)
      .positional('projectName', {
        type: 'string',
        alias: 'p',
        description: 'Which project should be viewed?',
      })
      .option('web', {
        type: 'boolean',
        description:
          'Show project details in the browser. (default when interactive)',
      })
      .option('open', {
        type: 'boolean',
        description:
          'Set to false to prevent the browser from opening when using --web',
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
      ),
  handler: async (args) => {
    const exitCode = await handleErrors(
      args.verbose ?? process.env.NX_VERBOSE_LOGGING === 'true',
      async () => {
        const { showProjectHandler } = await import('./project');
        await showProjectHandler(args);
      }
    );
    process.exit(exitCode);
  },
};
