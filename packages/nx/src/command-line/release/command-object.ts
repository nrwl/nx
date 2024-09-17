import { Argv, CommandModule, showHelp } from 'yargs';
import { readNxJson } from '../../config/nx-json';
import { readParallelFromArgsAndEnv } from '../../utils/command-line-utils';
import { logger } from '../../utils/logger';
import {
  OutputStyle,
  RunManyOptions,
  parseCSV,
  withAffectedOptions,
  withOutputStyleOption,
  withOverrides,
  withRunManyOptions,
  withVerbose,
} from '../yargs-utils/shared-options';
import { VersionData } from './utils/shared';

// Implemented by every command and subcommand
export interface BaseNxReleaseArgs {
  verbose?: boolean;
  printConfig?: boolean | 'debug';
}

export interface NxReleaseArgs extends BaseNxReleaseArgs {
  groups?: string[];
  projects?: string[];
  dryRun?: boolean;
}

interface GitCommitAndTagOptions {
  stageChanges?: boolean;
  gitCommit?: boolean;
  gitCommitMessage?: string;
  gitCommitArgs?: string | string[];
  gitTag?: boolean;
  gitTagMessage?: string;
  gitTagArgs?: string | string[];
}

export type VersionOptions = NxReleaseArgs &
  GitCommitAndTagOptions &
  VersionPlanArgs &
  FirstReleaseArgs & {
    specifier?: string;
    preid?: string;
    stageChanges?: boolean;
    generatorOptionsOverrides?: Record<string, unknown>;
  };

export type ChangelogOptions = NxReleaseArgs &
  GitCommitAndTagOptions &
  VersionPlanArgs &
  FirstReleaseArgs & {
    // version and/or versionData must be set
    version?: string | null;
    versionData?: VersionData;
    to?: string;
    from?: string;
    interactive?: string;
    gitRemote?: string;
    createRelease?: false | 'github';
  };

export type PublishOptions = NxReleaseArgs &
  Partial<RunManyOptions> & { outputStyle?: OutputStyle } & FirstReleaseArgs & {
    registry?: string;
    tag?: string;
    access?: string;
    otp?: number;
  };

export type PlanOptions = NxReleaseArgs & {
  bump?: string;
  message?: string;
  onlyTouched?: boolean;
};

export type PlanCheckOptions = BaseNxReleaseArgs & {
  base?: string;
  head?: string;
  files?: string;
  uncommitted?: boolean;
  untracked?: boolean;
};

export type ReleaseOptions = NxReleaseArgs &
  FirstReleaseArgs & {
    specifier?: string;
    yes?: boolean;
    skipPublish?: boolean;
  };

export type VersionPlanArgs = {
  deleteVersionPlans?: boolean;
};

export type FirstReleaseArgs = {
  firstRelease?: boolean;
};

export const yargsReleaseCommand: CommandModule<
  Record<string, unknown>,
  NxReleaseArgs
> = {
  command: 'release',
  describe:
    'Orchestrate versioning and publishing of applications and libraries.',
  builder: (yargs) =>
    withVerbose(yargs)
      .command(releaseCommand)
      .command(versionCommand)
      .command(changelogCommand)
      .command(publishCommand)
      .command(planCommand)
      .command(planCheckCommand)
      .demandCommand()
      // Error on typos/mistyped CLI args, there is no reason to support arbitrary unknown args for these commands
      .strictOptions()
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
          'Projects to run. (comma/space delimited project names and/or patterns).',
      })
      .option('dry-run', {
        describe:
          'Preview the changes without updating files/creating releases.',
        alias: 'd',
        type: 'boolean',
        default: false,
      })
      // NOTE: The camel case format is required for the coerce() function to be called correctly. It still supports --print-config casing.
      .option('printConfig', {
        type: 'string',
        describe:
          'Print the resolved nx release configuration that would be used for the current command and then exit.',
        coerce: (val: string) => {
          if (val === '') {
            return true;
          }
          if (val === 'false') {
            return false;
          }
          return val;
        },
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

const releaseCommand: CommandModule<NxReleaseArgs, ReleaseOptions> = {
  command: '$0 [specifier]',
  describe:
    'Create a version and release for the workspace, generate a changelog, and optionally publish the packages.',
  builder: (yargs) =>
    withFirstReleaseOptions(yargs)
      .positional('specifier', {
        type: 'string',
        describe:
          'Exact version or semver keyword to apply to the selected release group.',
      })
      .option('yes', {
        type: 'boolean',
        alias: 'y',
        description:
          'Automatically answer yes to the confirmation prompt for publishing.',
      })
      .option('skip-publish', {
        type: 'boolean',
        description:
          'Skip publishing by automatically answering no to the confirmation prompt for publishing.',
      })
      .check((argv) => {
        if (argv.yes !== undefined && argv.skipPublish !== undefined) {
          throw new Error(
            'The --yes and --skip-publish options are mutually exclusive, please use one or the other.'
          );
        }
        return true;
      }),
  handler: async (args) => {
    const release = await import('./release');
    const result = await release.releaseCLIHandler(args);
    if (args.dryRun) {
      logger.warn(`\nNOTE: The "dryRun" flag means no changes were made.`);
    }

    process.exit(result);
  },
};

const versionCommand: CommandModule<NxReleaseArgs, VersionOptions> = {
  command: 'version [specifier]',
  aliases: ['v'],
  describe:
    'Create a version and release for one or more applications and libraries.',
  builder: (yargs) =>
    withFirstReleaseOptions(
      withGitCommitAndGitTagOptions(
        yargs
          .positional('specifier', {
            type: 'string',
            describe:
              'Exact version or semver keyword to apply to the selected release group.',
          })
          .option('preid', {
            type: 'string',
            describe:
              'The optional prerelease identifier to apply to the version. This will only be applied in the case that the specifier argument has been set to `prerelease` OR when conventional commits are enabled, in which case it will modify the resolved specifier from conventional commits to be its prerelease equivalent. E.g. minor -> preminor.',
            default: '',
          })
          .option('stage-changes', {
            type: 'boolean',
            describe:
              'Whether or not to stage the changes made by this command. Useful when combining this command with changelog generation.',
          })
      )
    ),
  handler: async (args) => {
    const release = await import('./version');
    const result = await release.releaseVersionCLIHandler(args);
    if (args.dryRun) {
      logger.warn(`\nNOTE: The "dryRun" flag means no changes were made.`);
    }

    process.exit(result);
  },
};

const changelogCommand: CommandModule<NxReleaseArgs, ChangelogOptions> = {
  command: 'changelog [version]',
  aliases: ['c'],
  describe:
    'Generate a changelog for one or more projects, and optionally push to Github.',
  builder: (yargs) =>
    withFirstReleaseOptions(
      withGitCommitAndGitTagOptions(
        yargs
          // Disable default meaning of yargs version for this command
          .version(false)
          .positional('version', {
            type: 'string',
            description:
              'The version to create a Github release and changelog for.',
          })
          .option('from', {
            type: 'string',
            description:
              'The git reference to use as the start of the changelog. If not set it will attempt to resolve the latest tag and use that.',
          })
          .option('to', {
            type: 'string',
            description:
              'The git reference to use as the end of the changelog.',
            default: 'HEAD',
          })
          .option('interactive', {
            alias: 'i',
            type: 'string',
            description:
              'Interactively modify changelog markdown contents in your code editor before applying the changes. You can set it to be interactive for all changelogs, or only the workspace level, or only the project level.',
            choices: ['all', 'workspace', 'projects'],
          })
          .option('git-remote', {
            type: 'string',
            description:
              'Alternate git remote in the form {user}/{repo} on which to create the Github release (useful for testing).',
            default: 'origin',
          })
          .check((argv) => {
            if (!argv.version) {
              throw new Error(
                'An explicit target version must be specified when using the changelog command directly'
              );
            }
            return true;
          })
      )
    ),
  handler: async (args) => {
    const release = await import('./changelog');
    const result = await release.releaseChangelogCLIHandler(args);
    if (args.dryRun) {
      logger.warn(`\nNOTE: The "dryRun" flag means no changes were made.`);
    }

    process.exit(result);
  },
};

const publishCommand: CommandModule<NxReleaseArgs, PublishOptions> = {
  command: 'publish',
  aliases: ['p'],
  describe: 'Publish a versioned project to a registry.',
  builder: (yargs) =>
    withFirstReleaseOptions(
      withRunManyOptions(withOutputStyleOption(yargs))
        .option('registry', {
          type: 'string',
          description: 'The registry to publish to.',
        })
        .option('tag', {
          type: 'string',
          description:
            'The distribution tag to apply to the published package.',
        })
        .option('access', {
          type: 'string',
          choices: ['public', 'restricted'],
          description:
            'Overrides the access level of the published package. Unscoped packages cannot be set to restricted. See the npm publish documentation for more information.',
        })
        .option('otp', {
          type: 'number',
          description:
            'A one-time password for publishing to a registry that requires 2FA.',
        })
    ),
  handler: async (args) => {
    const status = await (
      await import('./publish')
    ).releasePublishCLIHandler(coerceParallelOption(withOverrides(args, 2)));
    if (args.dryRun) {
      logger.warn(`\nNOTE: The "dryRun" flag means no changes were made.`);
    }

    process.exit(status);
  },
};

const planCommand: CommandModule<NxReleaseArgs, PlanOptions> = {
  command: 'plan [bump]',
  aliases: ['pl'],
  describe:
    'Create a version plan file to specify the desired semver bump for one or more projects or groups, as well as the relevant changelog entry.',
  builder: (yargs) =>
    withAffectedOptions(yargs)
      .positional('bump', {
        type: 'string',
        describe: 'Semver keyword to use for the selected release group.',
        choices: [
          'major',
          'premajor',
          'minor',
          'preminor',
          'patch',
          'prepatch',
          'prerelease',
        ],
      })
      .option('message', {
        type: 'string',
        alias: 'm',
        describe: 'Custom message to use for the changelog entry.',
      })
      .option('onlyTouched', {
        type: 'boolean',
        describe:
          'Only include projects that have been affected by the current changes.',
        default: true,
      }),
  handler: async (args) => {
    const release = await import('./plan');
    const result = await release.releasePlanCLIHandler(args);
    if (args.dryRun) {
      logger.warn(`\nNOTE: The "dryRun" flag means no changes were made.`);
    }

    process.exit(result);
  },
};

const planCheckCommand: CommandModule<NxReleaseArgs, PlanCheckOptions> = {
  command: 'plan:check',
  describe:
    'Ensure that all touched projects have an applicable version plan created for them.',
  builder: (yargs) => withAffectedOptions(yargs),
  handler: async (args) => {
    const release = await import('./plan-check');
    const result = await release.releasePlanCheckCLIHandler(args);
    process.exit(result);
  },
};

function coerceParallelOption(args: any) {
  return {
    ...args,
    parallel: readParallelFromArgsAndEnv(args),
  };
}

function withGitCommitAndGitTagOptions<T>(
  yargs: Argv<T>
): Argv<T & GitCommitAndTagOptions> {
  return yargs
    .option('git-commit', {
      describe:
        'Whether or not to automatically commit the changes made by this command.',
      type: 'boolean',
    })
    .option('git-commit-message', {
      describe:
        'Custom git commit message to use when committing the changes made by this command. {version} will be dynamically interpolated when performing fixed releases, interpolated tags will be appended to the commit body when performing independent releases.',
      type: 'string',
    })
    .option('git-commit-args', {
      describe:
        'Additional arguments (added after the --message argument, which may or may not be customized with --git-commit-message) to pass to the `git commit` command invoked behind the scenes.',
      type: 'string',
    })
    .option('git-tag', {
      describe:
        'Whether or not to automatically tag the changes made by this command.',
      type: 'boolean',
    })
    .option('git-tag-message', {
      describe:
        'Custom git tag message to use when tagging the changes made by this command. This defaults to be the same value as the tag itself.',
      type: 'string',
    })
    .option('git-tag-args', {
      describe:
        'Additional arguments to pass to the `git tag` command invoked behind the scenes.',
      type: 'string',
    })
    .option('stage-changes', {
      describe:
        'Whether or not to stage the changes made by this command. Always treated as true if git-commit is true.',
      type: 'boolean',
    });
}

function withFirstReleaseOptions<T>(
  yargs: Argv<T>
): Argv<T & FirstReleaseArgs> {
  return yargs.option('first-release', {
    type: 'boolean',
    description:
      'Indicates that this is the first release for the selected release group. If the current version cannot be determined as usual, the version on disk will be used as a fallback. This is useful when using git or the registry to determine the current version of packages, since those sources are only available after the first release. Also indicates that changelog generation should not assume a previous git tag exists and that publishing should not check for the existence of the package before running.',
  });
}
