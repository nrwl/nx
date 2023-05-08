import { CommandModule } from 'yargs';
import { linkToNxDevAndExamples } from '../yargs-utils/documentation';
import {
  withAffectedOptions,
  withConfiguration,
  withDepGraphOptions,
  withOutputStyleOption,
  withOverrides,
  withRunOptions,
  withTargetAndConfigurationOption,
} from '../yargs-utils/shared-options';

export const yargsAffectedCommand: CommandModule = {
  command: 'affected',
  describe: 'Run target for affected projects',
  builder: (yargs) =>
    linkToNxDevAndExamples(
      withAffectedOptions(
        withRunOptions(
          withOutputStyleOption(withTargetAndConfigurationOption(yargs))
        )
      ),
      'affected'
    ),
  handler: async (args) =>
    (await import('./affected')).affected('affected', withOverrides(args)),
};

export const yargsAffectedTestCommand: CommandModule = {
  command: 'affected:test',
  describe: false,
  builder: (yargs) =>
    linkToNxDevAndExamples(
      withAffectedOptions(
        withRunOptions(withOutputStyleOption(withConfiguration(yargs)))
      ),
      'affected'
    ),
  handler: async (args) =>
    (await import('./affected')).affected('affected', {
      ...withOverrides(args),
      target: 'test',
    }),
};

export const yargsAffectedBuildCommand: CommandModule = {
  command: 'affected:build',
  describe: false,
  builder: (yargs) =>
    linkToNxDevAndExamples(
      withAffectedOptions(
        withRunOptions(withOutputStyleOption(withConfiguration(yargs)))
      ),
      'affected'
    ),
  handler: async (args) =>
    (await import('./affected')).affected('affected', {
      ...withOverrides(args),
      target: 'build',
    }),
};

export const yargsAffectedLintCommand: CommandModule = {
  command: 'affected:lint',
  describe: false,
  builder: (yargs) =>
    linkToNxDevAndExamples(
      withAffectedOptions(
        withRunOptions(withOutputStyleOption(withConfiguration(yargs)))
      ),
      'affected'
    ),
  handler: async (args) =>
    (await import('./affected')).affected('affected', {
      ...withOverrides(args),
      target: 'lint',
    }),
};

export const yargsAffectedE2ECommand: CommandModule = {
  command: 'affected:e2e',
  describe: false,
  builder: (yargs) =>
    linkToNxDevAndExamples(
      withAffectedOptions(
        withRunOptions(withOutputStyleOption(withConfiguration(yargs)))
      ),
      'affected'
    ),
  handler: async (args) =>
    (await import('./affected')).affected('affected', {
      ...withOverrides(args),
      target: 'e2e',
    }),
};

export const yargsAffectedGraphCommand: CommandModule = {
  command: 'affected:graph',
  describe: 'Graph dependencies affected by changes',
  aliases: ['affected:dep-graph'],
  builder: (yargs) =>
    linkToNxDevAndExamples(
      withAffectedOptions(withDepGraphOptions(yargs)),
      'affected:graph'
    ),
  handler: async (args) =>
    await (
      await import('./affected')
    ).affected('graph', {
      ...args,
    }),
};

export const yargsPrintAffectedCommand: CommandModule = {
  command: 'print-affected',
  describe:
    'Prints information about the projects and targets affected by changes',
  builder: (yargs) =>
    linkToNxDevAndExamples(
      withAffectedOptions(withTargetAndConfigurationOption(yargs, false)),
      'print-affected'
    )
      .option('select', {
        type: 'string',
        describe:
          'Select the subset of the returned json document (e.g., --select=projects)',
      })
      .option('type', {
        type: 'string',
        choices: ['app', 'lib'],
        describe:
          'Select the type of projects to be returned (e.g., --type=app)',
      }),
  handler: async (args) => {
    await (
      await import('./affected')
    ).affected('print-affected', withOverrides(args));
    process.exit(0);
  },
};
