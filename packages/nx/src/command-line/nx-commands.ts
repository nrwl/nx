import * as chalk from 'chalk';
import * as yargs from 'yargs';

import {
  yargsAffectedBuildCommand,
  yargsAffectedCommand,
  yargsAffectedE2ECommand,
  yargsAffectedGraphCommand,
  yargsAffectedLintCommand,
  yargsAffectedTestCommand,
  yargsPrintAffectedCommand,
} from './affected/command-object';
import {
  yargsConnectCommand,
  yargsViewLogsCommand,
} from './connect/command-object';
import { yargsDaemonCommand } from './daemon/command-object';
import { yargsDepGraphCommand } from './graph/command-object';
import { yargsExecCommand } from './exec/command-object';
import {
  yargsFormatCheckCommand,
  yargsFormatWriteCommand,
} from './format/command-object';
import {
  yargsGenerateCommand,
  yargsWorkspaceGeneratorCommand,
} from './generate/command-object';
import { yargsInitCommand } from './init/command-object';
import { yargsListCommand } from './list/command-object';
import {
  yargsInternalMigrateCommand,
  yargsMigrateCommand,
} from './migrate/command-object';
import { yargsNewCommand } from './new/command-object';
import { yargsRepairCommand } from './repair/command-object';
import { yargsReportCommand } from './report/command-object';
import { yargsRunCommand } from './run/command-object';
import { yargsRunManyCommand } from './run-many/command-object';
import { yargsShowCommand } from './show/command-object';
import { yargsWatchCommand } from './watch/command-object';
import { yargsWorkspaceLintCommand } from './workspace-lint/command-object';
import { yargsResetCommand } from './reset/command-object';

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
  .usage(chalk.bold('Smart, Fast and Extensible Build System'))
  .demandCommand(1, '')
  .command(yargsAffectedBuildCommand)
  .command(yargsAffectedCommand)
  .command(yargsAffectedE2ECommand)
  .command(yargsAffectedGraphCommand)
  .command(yargsAffectedLintCommand)
  .command(yargsAffectedTestCommand)
  .command(yargsConnectCommand)
  .command(yargsDaemonCommand)
  .command(yargsDepGraphCommand)
  .command(yargsExecCommand)
  .command(yargsFormatCheckCommand)
  .command(yargsFormatWriteCommand)
  .command(yargsGenerateCommand)
  .command(yargsInitCommand)
  .command(yargsInternalMigrateCommand)
  .command(yargsListCommand)
  .command(yargsMigrateCommand)
  .command(yargsNewCommand)
  .command(yargsPrintAffectedCommand)
  .command(yargsRepairCommand)
  .command(yargsReportCommand)
  .command(yargsResetCommand)
  .command(yargsRunCommand)
  .command(yargsRunManyCommand)
  .command(yargsShowCommand)
  .command(yargsViewLogsCommand)
  .command(yargsWatchCommand)
  .command(yargsWorkspaceGeneratorCommand)
  .command(yargsWorkspaceLintCommand)
  .scriptName('nx')
  .help()
  // NOTE: we handle --version in nx.ts, this just tells yargs that the option exists
  // so that it shows up in help. The default yargs implementation of --version is not
  // hit, as the implementation in nx.ts is hit first and calls process.exit(0).
  .version();
