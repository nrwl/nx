import type { Argv, CommandModule } from 'yargs';
import { output } from '../../utils/output';
import { withVerbose } from '../yargs-utils/shared-options';

export type ConformanceCommand = 'conformance' | 'conformance:check';

export function resolveConformanceCommandObject(
  command: ConformanceCommand
): CommandModule {
  let commandObject: CommandModule;
  try {
    const conformance = require('@nx/conformance');
    commandObject =
      command === 'conformance'
        ? conformance.yargsConformanceCommand
        : conformance.yargsConformanceCheckCommand;
  } catch (e) {
    return isConformanceNotInstalled(e)
      ? createMissingConformanceCommand(command)
      : createUnloadableConformanceCommand(command, e);
  }

  return {
    ...commandObject,
    builder: (yargs) =>
      (commandObject.builder as (yargs: Argv) => Argv)(withVerbose(yargs)),
  };
}

// Only a missing @nx/conformance itself means the plugin is not installed.
// Any other load error is a broken install and is reported as such.
function isConformanceNotInstalled(e: unknown): boolean {
  return (
    (e as NodeJS.ErrnoException)?.code === 'MODULE_NOT_FOUND' &&
    (e as Error).message.includes(`'@nx/conformance'`)
  );
}

function createMissingConformanceCommand(
  command: ConformanceCommand
): CommandModule {
  return {
    command,
    // Hidden from --help until the plugin is installed
    describe: false,
    handler: () => {
      output.error({
        title: `nx ${command} requires the @nx/conformance plugin`,
        bodyLines: [
          'Install it by running `nx add @nx/conformance`.',
          '',
          'To learn more, visit https://nx.dev/docs/reference/conformance/overview',
        ],
      });
      process.exit(1);
    },
  };
}

function createUnloadableConformanceCommand(
  command: ConformanceCommand,
  error: unknown
): CommandModule {
  return {
    command,
    describe: false,
    handler: () => {
      output.error({
        title: `nx ${command} could not load the @nx/conformance plugin`,
        bodyLines: [
          error instanceof Error ? error.message : String(error),
          '',
          'Reinstall your dependencies, and make sure @nx/conformance matches your nx version.',
        ],
      });
      process.exit(1);
    },
  };
}
