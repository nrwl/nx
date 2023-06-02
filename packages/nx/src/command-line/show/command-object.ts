import { CommandModule, showHelp } from 'yargs';
import { parseCSV, withAffectedOptions } from '../yargs-utils/shared-options';

export interface NxShowArgs {
  json?: boolean;
}

export type ShowProjectsOptions = NxShowArgs & {
  exclude: string;
  files: string;
  uncommitted: any;
  untracked: any;
  base: string;
  head: string;
  affected: boolean;
  projects: string[];
  withTarget: string;
};

export type ShowProjectOptions = NxShowArgs & {
  projectName: string;
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
        '$0 show targets',
        'Show a list of all targets in the workspace'
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
    withAffectedOptions(yargs)
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
      })
      .implies('untracked', 'affected')
      .implies('uncommitted', 'affected')
      .implies('files', 'affected')
      .implies('base', 'affected')
      .implies('head', 'affected')
      .example(
        '$0 show projects --patterns "apps/*"',
        'Show all projects in the apps directory'
      )
      .example(
        '$0 show projects --patterns "shared-*"',
        'Show all projects that start with "shared-"'
      )
      .example(
        '$0 show projects --affected',
        'Show affected projects in the workspace'
      )
      .example(
        '$0 show projects --affected --exclude *-e2e',
        'Show affected projects in the workspace, excluding end-to-end projects'
      ) as any,
  handler: (args) => import('./show').then((m) => m.showProjectsHandler(args)),
};

const showProjectCommand: CommandModule<NxShowArgs, ShowProjectOptions> = {
  command: 'project <projectName>',
  describe: 'Show a list of targets in the workspace.',
  builder: (yargs) =>
    yargs
      .positional('projectName', {
        type: 'string',
        alias: 'p',
        description: 'Show targets for the given project',
      })
      .default('json', true)
      .example(
        '$0 show project my-app',
        'View project information for my-app in JSON format'
      ),
  handler: (args) => import('./show').then((m) => m.showProjectHandler(args)),
};
