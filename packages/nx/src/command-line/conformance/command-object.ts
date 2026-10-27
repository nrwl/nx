import type { CommandModule } from 'yargs';
import { handleImport } from '../../utils/handle-import';
import { output } from '../../utils/output';

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
  } catch {
    return createMissingConformanceCommand(command);
  }

  return {
    ...commandObject,
    handler: async (args) =>
      (await handleImport('./conformance.js', __dirname)).conformanceHandler(
        command,
        args,
        commandObject.handler
      ),
  };
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
