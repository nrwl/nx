import * as chalk from 'chalk';
import * as yargs from 'yargs';

import { yargsRegisterCommand } from './register/command-object.js';
import {
  yargsAffectedBuildCommand,
  yargsAffectedCommand,
  yargsAffectedE2ECommand,
  yargsAffectedLintCommand,
  yargsAffectedTestCommand,
} from './affected/command-object.js';
import {
  yargsConnectCommand,
  yargsViewLogsCommand,
} from './nx-cloud/connect/command-object.js';
import { yargsDaemonCommand } from './daemon/command-object.js';
import { yargsGraphCommand } from './graph/command-object.js';
import { yargsExecCommand } from './exec/command-object.js';
import {
  yargsFormatCheckCommand,
  yargsFormatWriteCommand,
} from './format/command-object.js';
import { yargsGenerateCommand } from './generate/command-object.js';
import { yargsImportCommand } from './import/command-object.js';
import { yargsInitCommand } from './init/command-object.js';
import { yargsListCommand } from './list/command-object.js';
import {
  yargsInternalMigrateCommand,
  yargsMigrateCommand,
} from './migrate/command-object.js';
import { yargsNewCommand } from './new/command-object.js';
import { yargsRepairCommand } from './repair/command-object.js';
import { yargsReportCommand } from './report/command-object.js';
import { yargsNxInfixCommand, yargsRunCommand } from './run/command-object.js';
import { yargsRunManyCommand } from './run-many/command-object.js';
import { yargsShowCommand } from './show/command-object.js';
import { yargsWatchCommand } from './watch/command-object.js';
import { yargsResetCommand } from './reset/command-object.js';
import { yargsReleaseCommand } from './release/command-object.js';
import { yargsAddCommand } from './add/command-object.js';
import { yargsConfigureAiAgentsCommand } from './configure-ai-agents/command-object.js';
import { yargsLoginCommand } from './nx-cloud/login/command-object.js';
import { yargsLogoutCommand } from './nx-cloud/logout/command-object.js';
import { yargsRecordCommand } from './nx-cloud/record/command-object.js';
import { yargsStartCiRunCommand } from './nx-cloud/start-ci-run/command-object.js';
import { yargsStartAgentCommand } from './nx-cloud/start-agent/command-object.js';
import { yargsStopAllAgentsCommand } from './nx-cloud/complete-run/command-object.js';
import { yargsFixCiCommand } from './nx-cloud/fix-ci/command-object.js';
import {
  yargsPrintAffectedCommand,
  yargsAffectedGraphCommand,
} from './deprecated/command-objects.js';
import { yargsSyncCheckCommand, yargsSyncCommand } from './sync/command-object.js';
import { output } from '../utils/output.js';
import { yargsMcpCommand } from './mcp/command-object.js';

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
 * be executed correctly.
 */
export const commandsObject = yargs
  .parserConfiguration(parserConfiguration)
  .usage(chalk.bold('Smart Repos · Fast Builds'))
  .demandCommand(1, '')
  .command(yargsRegisterCommand)
  .command(yargsAddCommand)
  .command(yargsConfigureAiAgentsCommand)
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
  .command(yargsRecordCommand)
  .command(yargsStartCiRunCommand)
  .command(yargsStartAgentCommand)
  .command(yargsStopAllAgentsCommand)
  .command(yargsFixCiCommand)
  .command(yargsMcpCommand)
  .command(resolveConformanceCommandObject())
  .command(resolveConformanceCheckCommandObject())
  .scriptName('nx')
  .help(false)
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
          `In order to use the \`nx ${command}\` command you must have an active Nx key and the \`@nx/conformance\` plugin installed.`,
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
    const { yargsConformanceCommand } = (() => {
      try {
        return require('@nx/powerpack-conformance');
      } catch {
        return require('@nx/conformance');
      }
    })();
    return yargsConformanceCommand;
  } catch {
    return createMissingConformanceCommand('conformance');
  }
}

function resolveConformanceCheckCommandObject() {
  try {
    const { yargsConformanceCheckCommand } = (() => {
      try {
        return require('@nx/powerpack-conformance');
      } catch {
        return require('@nx/conformance');
      }
    })();
    return yargsConformanceCheckCommand;
  } catch {
    return createMissingConformanceCommand('conformance:check');
  }
}
