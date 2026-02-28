import { CommandModule } from 'yargs';
import { handleErrors } from '../../utils/handle-errors';
import { linkToNxDevAndExamples } from '../yargs-utils/documentation';
import {
  withAffectedOptions,
  withBatch,
  withConfiguration,
  withOutputStyleOption,
  withOverrides,
  withRunOptions,
  withTargetAndConfigurationOption,
  withTuiOptions,
} from '../yargs-utils/shared-options';
import { exitAndFlushAnalytics } from '../../analytics/analytics';

export const yargsAffectedCommand: CommandModule = {
  command: 'affected',
  describe:
    'Run target for affected projects. Affected projects are projects that have been changed and projects that depend on the changed projects. See https://nx.dev/ci/features/affected for more details.',
  builder: (yargs) =>
    linkToNxDevAndExamples(
      withAffectedOptions(
        withTuiOptions(
          withRunOptions(
            withOutputStyleOption(
              withTargetAndConfigurationOption(withBatch(yargs))
            )
          )
        )
      )
        .option('all', {
          type: 'boolean',
          deprecated: 'Use `nx run-many` instead',
        })
        .middleware((args) => {
          if (args.all !== undefined) {
            throw new Error(
              "The '--all' option has been removed for `nx affected`. Use 'nx run-many' instead."
            );
          }
        }),
      'affected'
    ),
  handler: async (args) => {
    const exitCode = await handleErrors(
      (args.verbose as boolean) ?? process.env.NX_VERBOSE_LOGGING === 'true',
      async () => {
        return (await import('./affected')).affected(
          'affected',
          withOverrides(args)
        );
      }
    );
    exitAndFlushAnalytics(exitCode);
  },
};

export const yargsAffectedTestCommand: CommandModule = {
  command: 'affected:test',
  describe: false,
  builder: (yargs) =>
    linkToNxDevAndExamples(
      withAffectedOptions(
        withTuiOptions(
          withRunOptions(withOutputStyleOption(withConfiguration(yargs)))
        )
      ),
      'affected'
    ),
  handler: async (args) => {
    const exitCode = await handleErrors(
      (args.verbose as boolean) ?? process.env.NX_VERBOSE_LOGGING === 'true',
      async () => {
        return (await import('./affected')).affected('affected', {
          ...withOverrides(args),
          target: 'test',
        });
      }
    );
    exitAndFlushAnalytics(exitCode);
  },
};

export const yargsAffectedBuildCommand: CommandModule = {
  command: 'affected:build',
  describe: false,
  builder: (yargs) =>
    linkToNxDevAndExamples(
      withAffectedOptions(
        withTuiOptions(
          withRunOptions(withOutputStyleOption(withConfiguration(yargs)))
        )
      ),
      'affected'
    ),
  handler: async (args) => {
    const exitCode = await handleErrors(
      (args.verbose as boolean) ?? process.env.NX_VERBOSE_LOGGING === 'true',
      async () => {
        return (await import('./affected')).affected('affected', {
          ...withOverrides(args),
          target: 'build',
        });
      }
    );
    exitAndFlushAnalytics(exitCode);
  },
};

export const yargsAffectedLintCommand: CommandModule = {
  command: 'affected:lint',
  describe: false,
  builder: (yargs) =>
    linkToNxDevAndExamples(
      withAffectedOptions(
        withTuiOptions(
          withRunOptions(withOutputStyleOption(withConfiguration(yargs)))
        )
      ),
      'affected'
    ),
  handler: async (args) => {
    const exitCode = await handleErrors(
      (args.verbose as boolean) ?? process.env.NX_VERBOSE_LOGGING === 'true',
      async () => {
        return (await import('./affected')).affected('affected', {
          ...withOverrides(args),
          target: 'lint',
        });
      }
    );
    exitAndFlushAnalytics(exitCode);
  },
};

export const yargsAffectedE2ECommand: CommandModule = {
  command: 'affected:e2e',
  describe: false,
  builder: (yargs) =>
    linkToNxDevAndExamples(
      withAffectedOptions(
        withTuiOptions(
          withRunOptions(withOutputStyleOption(withConfiguration(yargs)))
        )
      ),
      'affected'
    ),
  handler: async (args) => {
    const exitCode = await handleErrors(
      (args.verbose as boolean) ?? process.env.NX_VERBOSE_LOGGING === 'true',
      async () => {
        return (await import('./affected')).affected('affected', {
          ...withOverrides(args),
          target: 'e2e',
        });
      }
    );
    exitAndFlushAnalytics(exitCode);
  },
};
