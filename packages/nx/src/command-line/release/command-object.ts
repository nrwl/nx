import { CommandModule, showHelp } from 'yargs';
import { readNxJson } from '../../project-graph/file-utils';
import {
  RunManyOptions,
  parseCSV,
  withOutputStyleOption,
  withOverrides,
  withRunManyOptions,
} from '../yargs-utils/shared-options';

export interface NxReleaseArgs {
  groups?: string[];
  projects?: string[];
  dryRun?: boolean;
  verbose?: boolean;
}

export type VersionOptions = NxReleaseArgs & {
  specifier?: string;
  preid?: string;
};

export type ChangelogOptions = NxReleaseArgs & {
  version: string;
  to: string;
  from?: string;
  interactive?: string;
  gitRemote?: string;
  tagVersionPrefix?: string;
};

export type PublishOptions = NxReleaseArgs &
  RunManyOptions & {
    registry?: string;
    tag?: string;
  };

export const yargsReleaseCommand: CommandModule<
  Record<string, unknown>,
  NxReleaseArgs
> = {
  command: 'release',
  describe:
    '**ALPHA**: Orchestrate versioning and publishing of applications and libraries',
  builder: (yargs) =>
    yargs
      .command(versionCommand)
      .command(changelogCommand)
      .command(publishCommand)
      .demandCommand()
      .option('groups', {
        description:
          'One or more release groups to target with the current command.',
        type: 'string',
        coerce: parseCSV,
        alias: ['group', 'g'],
      })
      .option('projects', {
        type: 'string',
        alias: 'p',
        coerce: parseCSV,
        describe:
          'Projects to run. (comma/space delimited project names and/or patterns)',
      })
      .option('dryRun', {
        describe:
          'Preview the changes without updating files/creating releases',
        alias: 'd',
        type: 'boolean',
        default: false,
      })
      .option('verbose', {
        type: 'boolean',
        describe:
          'Prints additional information about the commands (e.g., stack traces)',
      })
      .check((argv) => {
        if (argv.groups && argv.projects) {
          throw new Error(
            'The --projects and --groups options are mutually exclusive, please use one or the other.'
          );
        }
        const nxJson = readNxJson();
        if (argv.groups?.length) {
          for (const group of argv.groups) {
            if (!nxJson.release?.groups?.[group]) {
              throw new Error(
                `The specified release group "${group}" was not found in nx.json`
              );
            }
          }
        }
        return true;
      }) as any, // the type: 'string' and coerce: parseCSV combo isn't enough to produce the string[] type for projects and groups
  handler: async () => {
    showHelp();
    process.exit(1);
  },
};

const versionCommand: CommandModule<NxReleaseArgs, VersionOptions> = {
  command: 'version [specifier]',
  aliases: ['v'],
  describe:
    'Create a version and release for one or more applications and libraries',
  builder: (yargs) =>
    yargs
      .positional('specifier', {
        type: 'string',
        describe:
          'Exact version or semver keyword to apply to the selected release group.',
      })
      .option('preid', {
        type: 'string',
        describe:
          'The optional prerelease identifier to apply to the version, in the case that specifier has been set to prerelease.',
        default: '',
      }),
  handler: (args) => import('./version').then((m) => m.versionHandler(args)),
};

const changelogCommand: CommandModule<NxReleaseArgs, ChangelogOptions> = {
  command: 'changelog [version]',
  aliases: ['c'],
  describe:
    'Generate a changelog for one or more projects, and optionally push to Github',
  builder: (yargs) =>
    yargs
      // Disable default meaning of yargs version for this command
      .version(false)
      .positional('version', {
        type: 'string',
        description: 'The version to create a Github release and changelog for',
      })
      .option('from', {
        type: 'string',
        description:
          'The git reference to use as the start of the changelog. If not set it will attempt to resolve the latest tag and use that',
      })
      .option('to', {
        type: 'string',
        description: 'The git reference to use as the end of the changelog',
        default: 'HEAD',
      })
      .option('interactive', {
        alias: 'i',
        type: 'string',
        description:
          'Interactively modify changelog markdown contents in your code editor before applying the changes. You can set it to be interactive for all changelogs, or only the workspace level, or only the project level',
        choices: ['all', 'workspace', 'projects'],
      })
      .option('gitRemote', {
        type: 'string',
        description:
          'Alternate git remote in the form {user}/{repo} on which to create the Github release (useful for testing)',
        default: 'origin',
      })
      .option('tagVersionPrefix', {
        type: 'string',
        description:
          'Prefix to apply to the version when creating the Github release tag',
        default: 'v',
      })
      .check((argv) => {
        if (!argv.version) {
          throw new Error('A target version must be specified');
        }
        if (argv.file === false && argv.createRelease !== 'github') {
          throw new Error(
            'The --file option can only be set to false when --create-release is set to github.'
          );
        }
        return true;
      }),
  handler: (args) =>
    import('./changelog').then((m) => m.changelogHandler(args)),
};

const publishCommand: CommandModule<NxReleaseArgs, PublishOptions> = {
  command: 'publish',
  aliases: ['p'],
  describe: 'Publish a versioned project to a registry',
  builder: (yargs) =>
    withRunManyOptions(withOutputStyleOption(yargs))
      .option('registry', {
        type: 'string',
        description: 'The registry to publish to',
      })
      .option('tag', {
        type: 'string',
        description: 'The distribution tag to apply to the published package',
      }),
  handler: (args) =>
    import('./publish').then((m) =>
      m.publishHandler(coerceParallelOption(withOverrides(args, 2)))
    ),
};

function coerceParallelOption(args: any) {
  if (args['parallel'] === 'false' || args['parallel'] === false) {
    return {
      ...args,
      parallel: 1,
    };
  } else if (
    args['parallel'] === 'true' ||
    args['parallel'] === true ||
    args['parallel'] === ''
  ) {
    return {
      ...args,
      parallel: Number(args['maxParallel'] || args['max-parallel'] || 3),
    };
  } else if (args['parallel'] !== undefined) {
    return {
      ...args,
      parallel: Number(args['parallel']),
    };
  }
  return args;
}
