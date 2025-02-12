import * as chalk from 'chalk';
import * as yargs from 'yargs';

import { yargsActivatePowerpackCommand } from './activate-powerpack/command-object';
import {
  yargsAffectedBuildCommand,
  yargsAffectedCommand,
  yargsAffectedE2ECommand,
  yargsAffectedLintCommand,
  yargsAffectedTestCommand,
} from './affected/command-object';
import {
  yargsConnectCommand,
  yargsViewLogsCommand,
} from './connect/command-object';
import { yargsDaemonCommand } from './daemon/command-object';
import { yargsGraphCommand } from './graph/command-object';
import { yargsExecCommand } from './exec/command-object';
import {
  yargsFormatCheckCommand,
  yargsFormatWriteCommand,
} from './format/command-object';
import { yargsGenerateCommand } from './generate/command-object';
import { yargsImportCommand } from './import/command-object';
import { yargsInitCommand } from './init/command-object';
import { yargsListCommand } from './list/command-object';
import {
  yargsInternalMigrateCommand,
  yargsMigrateCommand,
} from './migrate/command-object';
import { yargsNewCommand } from './new/command-object';
import { yargsRepairCommand } from './repair/command-object';
import { yargsReportCommand } from './report/command-object';
import { yargsNxInfixCommand, yargsRunCommand } from './run/command-object';
import { yargsRunManyCommand } from './run-many/command-object';
import { yargsShowCommand } from './show/command-object';
import { yargsWatchCommand } from './watch/command-object';
import { yargsResetCommand } from './reset/command-object';
import { yargsReleaseCommand } from './release/command-object';
import { yargsAddCommand } from './add/command-object';
import { yargsLoginCommand } from './login/command-object';
import { yargsLogoutCommand } from './logout/command-object';
import {
  yargsPrintAffectedCommand,
  yargsAffectedGraphCommand,
} from './deprecated/command-objects';
import { yargsSyncCheckCommand, yargsSyncCommand } from './sync/command-object';
import { output } from '../utils/output';

// Ensure that the output takes up the available width of the terminal.
yargs.wrap(yargs.terminalWidth());

export const parserConfiguration: Partial<yargs.ParserConfigurationOptions> = {
  'strip-dashed': true,
};

/**
 * Exposing the Yargs commands object so the documentation generator can
 * parse it. The CLI will consume it and call the `.argv` to bootstrapped
 * the CLI. These command declarations needs to be in a different file
 * from the `.argv` call, so the object and it's relative scripts can
 * le executed correctly.
 */
export const commandsObject = yargs
  .parserConfiguration(parserConfiguration)
  .usage(chalk.bold('Smart Monorepos · Fast CI'))
  .demandCommand(1, '')
  .command(yargsActivatePowerpackCommand)
  .command(yargsAddCommand)
  .command(yargsAffectedBuildCommand)
  .command(yargsAffectedCommand)
  .command(yargsAffectedE2ECommand)
  .command(yargsAffectedLintCommand)
  .command(yargsAffectedTestCommand)
  .command(yargsAffectedGraphCommand)
  .command(yargsConnectCommand)
  .command(yargsDaemonCommand)
  .command(yargsGraphCommand)
  .command(yargsExecCommand)
  .command(yargsFormatCheckCommand)
  .command(yargsFormatWriteCommand)
  .command(yargsGenerateCommand)
  .command(yargsImportCommand)
  .command(yargsInitCommand)
  .command(yargsInternalMigrateCommand)
  .command(yargsListCommand)
  .command(yargsMigrateCommand)
  .command(yargsNewCommand)
  .command(yargsPrintAffectedCommand)
  .command(yargsReleaseCommand)
  .command(yargsRepairCommand)
  .command(yargsReportCommand)
  .command(yargsResetCommand)
  .command(yargsRunCommand)
  .command(yargsRunManyCommand)
  .command(yargsShowCommand)
  .command(yargsSyncCommand)
  .command(yargsSyncCheckCommand)
  .command(yargsViewLogsCommand)
  .command(yargsWatchCommand)
  .command(yargsNxInfixCommand)
  .command(yargsLoginCommand)
  .command(yargsLogoutCommand)
  .command(resolveConformanceCommandObject())
  .command(resolveConformanceCheckCommandObject())
  .scriptName('nx')
  .help()
  // NOTE: we handle --version in nx.ts, this just tells yargs that the option exists
  // so that it shows up in help. The default yargs implementation of --version is not
  // hit, as the implementation in nx.ts is hit first and calls process.exit(0).
  .version();

function createMissingConformanceCommand(
  command: 'conformance' | 'conformance:check'
) {
  return {
    command,
    // Hide from --help output in the common case of not having the plugin installed
    describe: false,
    handler: () => {
      output.error({
        title: `${command} is not available`,
        bodyLines: [
          `In order to use the \`nx ${command}\` command you must have an active Powerpack license and the \`@nx/powerpack-conformance\` plugin installed.`,
          '',
          'To learn more, visit https://nx.dev/nx-enterprise/powerpack/conformance',
        ],
      });
      process.exit(1);
    },
  };
}

function resolveConformanceCommandObject() {
  try {
    const { yargsConformanceCommand } = require('@nx/powerpack-conformance');
    return yargsConformanceCommand;
  } catch {
    return createMissingConformanceCommand('conformance');
  }
}

function resolveConformanceCheckCommandObject() {
  try {
    const {
      yargsConformanceCheckCommand,
    } = require('@nx/powerpack-conformance');
    return yargsConformanceCheckCommand;
  } catch {
    return createMissingConformanceCommand('conformance:check');
  }
}
