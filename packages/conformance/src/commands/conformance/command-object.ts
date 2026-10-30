import type { Argv, CommandModule } from 'yargs';
import { ConformanceArgs } from './conformance';

export const yargsConformanceCommand: CommandModule = {
  command: 'conformance',
  describe: 'Run configured conformance rules and their fix generators.',
  builder: (yargs) => withPrintConfig(yargs),
  handler: async (args) => {
    const exitCode = await import('./conformance.js').then(
      ({ conformanceHandler }) =>
        conformanceHandler(args as ConformanceArgs, true)
    );
    process.exit(exitCode ?? 0);
  },
};

export const yargsConformanceCheckCommand: CommandModule = {
  command: 'conformance:check',
  describe:
    'Run configured conformance rules without running fix generators, useful for CI.',
  builder: (yargs) => withPrintConfig(yargs),
  handler: async (args) => {
    const exitCode = await import('./conformance.js').then(
      ({ conformanceHandler }) =>
        conformanceHandler(args as ConformanceArgs, false)
    );
    process.exit(exitCode ?? 0);
  },
};

function withPrintConfig(yargs: Argv) {
  return yargs.option('printConfig', {
    describe:
      'Prints the resolved conformance rules, including any Nx Cloud Enterprise data, if applicable.',
    type: 'boolean',
  });
}
