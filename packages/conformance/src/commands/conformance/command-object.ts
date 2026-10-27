import type { Argv, CommandModule } from 'yargs';
import { ConformanceArgs } from './conformance';

export const yargsConformanceCommand: CommandModule = {
  command: 'conformance',
  describe: 'Run configured conformance rules and their fix generators.',
  builder: (yargs) => withVerbose(withPrintConfig(yargs)),
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
  builder: (yargs) => withVerbose(withPrintConfig(yargs)),
  handler: async (args) => {
    const exitCode = await import('./conformance.js').then(
      ({ conformanceHandler }) =>
        conformanceHandler(args as ConformanceArgs, false)
    );
    process.exit(exitCode ?? 0);
  },
};

// TODO: import withVerbose from nx internals once Nx 18 support is dropped. This copy
// matches packages/nx/src/command-line/yargs-utils/shared-options.ts.
function withVerbose(yargs: Argv) {
  return yargs
    .option('verbose', {
      describe:
        'Prints additional information about the commands (e.g., stack traces).',
      type: 'boolean',
    })
    .middleware((args) => {
      args.verbose ??= process.env.NX_VERBOSE_LOGGING === 'true';
      // If NX_VERBOSE_LOGGING=false and --verbose is passed, we want to set it to true favoring the arg
      process.env.NX_VERBOSE_LOGGING = args.verbose.toString();
    });
}

function withPrintConfig(yargs: Argv) {
  return yargs.option('printConfig', {
    describe:
      'Prints the resolved conformance rules, including any Nx Cloud Enterprise data, if applicable.',
    type: 'boolean',
  });
}
