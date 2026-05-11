import * as pc from 'picocolors';
import * as yargs from 'yargs';

import { reportCommandRunEvent } from '../analytics';
import { output } from '../utils/output';
import { yargsAddCommand } from './add/command-object';
import {
  yargsAffectedBuildCommand,
  yargsAffectedCommand,
  yargsAffectedE2ECommand,
  yargsAffectedLintCommand,
  yargsAffectedTestCommand,
} from './affected/command-object';
import { yargsConfigureAiAgentsCommand } from './configure-ai-agents/command-object';
import { yargsDaemonCommand } from './daemon/command-object';
import {
  yargsAffectedGraphCommand,
  yargsPrintAffectedCommand,
} from './deprecated/command-objects';
import { yargsExecCommand } from './exec/command-object';
import {
  yargsFormatCheckCommand,
  yargsFormatWriteCommand,
} from './format/command-object';
import { yargsGenerateCommand } from './generate/command-object';
import { yargsGraphCommand } from './graph/command-object';
import { yargsImportCommand } from './import/command-object';
import { yargsInitCommand } from './init/command-object';
import { yargsListCommand } from './list/command-object';
import { yargsMcpCommand } from './mcp/command-object';
import {
  yargsInternalMigrateCommand,
  yargsMigrateCommand,
} from './migrate/command-object';
import { yargsNewCommand } from './new/command-object';
import { yargsApplyLocallyCommand } from './nx-cloud/apply-locally/command-object';
import { yargsStopAllAgentsCommand } from './nx-cloud/complete-run/command-object';
import {
  yargsConnectCommand,
  yargsViewLogsCommand,
} from './nx-cloud/connect/command-object';
import { yargsDownloadCloudClientCommand } from './nx-cloud/download-cloud-client/command-object';
import { yargsFixCiCommand } from './nx-cloud/fix-ci/command-object';
import { yargsLoginCommand } from './nx-cloud/login/command-object';
import { yargsLogoutCommand } from './nx-cloud/logout/command-object';
import { yargsRecordCommand } from './nx-cloud/record/command-object';
import { yargsStartAgentCommand } from './nx-cloud/start-agent/command-object';
import { yargsStartCiRunCommand } from './nx-cloud/start-ci-run/command-object';
import { yargsRegisterCommand } from './register/command-object';
import { yargsReleaseCommand } from './release/command-object';
import { yargsRepairCommand } from './repair/command-object';
import { yargsReportCommand } from './report/command-object';
import { yargsResetCommand } from './reset/command-object';
import { yargsRunManyCommand } from './run-many/command-object';
import { yargsNxInfixCommand, yargsRunCommand } from './run/command-object';
import { yargsShowCommand } from './show/command-object';
import { yargsSyncCheckCommand, yargsSyncCommand } from './sync/command-object';
import { yargsWatchCommand } from './watch/command-object';
import { yargsCompletionCommand } from './completion/command-object';
import { getValueCompletions } from './completion/value-completions';
import { getCommandCompletions } from './completion/command-completions';

// Ensure that the output takes up the available width of the terminal.
yargs.wrap(yargs.terminalWidth());

// Yargs's `.completion(...)` flag check looks for the dashed key in argv during
// parse. When `strip-dashed: true` removes it, yargs falls through to normal
// command matching and fires handlers instead of the completion callback. Opt
// out of strip-dashed for completion runs only — handlers don't run during
// completion, so nothing else is affected.
const isCompletionRequest = process.argv.includes('--get-yargs-completions');

export const parserConfiguration: Partial<yargs.ParserConfigurationOptions> = {
  'strip-dashed': !isCompletionRequest,
};

function fallbackCompletion(
  current: string,
  argv: { _?: Array<string | number> },
  defaultCompletions: (
    cb: (err: Error | null, defaults: string[]) => void
  ) => void,
  done: (completions: ReadonlyArray<string>) => void
): void {
  try {
    const positional = (argv?._ ?? []).map(String);
    // yargs may include the script name in argv._; drop it so callers see
    // just the command tokens (e.g. ['show', 'project']).
    const args = positional[0] === 'nx' ? positional.slice(1) : positional;

    // Value completions first (project/target/generator names, flag values).
    const dynamic = getValueCompletions(current, args);
    if (dynamic !== null) {
      done(dynamic);
      return;
    }

    // Subcommand + option-name completion for matched top-level commands. Walks
    // manually instead of letting yargs's defaultCompletion recurse (its
    // reset() wipes our boolean-flag declaration and causes help text to
    // leak into stdout for some commands like run-many/affected).
    const matched = getCommandCompletions(current, args);
    if (matched !== null) {
      done(matched);
      return;
    }
  } catch {
    // Fall through to defaults — completion must never surface errors to the shell.
  }
  defaultCompletions((err, defaults) => {
    done(err ? [] : defaults);
  });
}

/**
 * Exposing the Yargs commands object so the documentation generator can
 * parse it. The CLI will consume it and call the `.argv` to bootstrapped
 * the CLI. These command declarations needs to be in a different file
 * from the `.argv` call, so the object and it's relative scripts can
 * be executed correctly.
 */
export const commandsObject = yargs
  .parserConfiguration(parserConfiguration)
  .usage(pc.bold('Smart Monorepos · Fast Builds'))
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
  .command(yargsApplyLocallyCommand)
  .command(yargsDownloadCloudClientCommand)
  .command(yargsMcpCommand)
  .command(yargsCompletionCommand)
  .command(resolveConformanceCommandObject())
  .command(resolveConformanceCheckCommandObject())
  // Declare --get-yargs-completions as a boolean so yargs's parser doesn't
  // consume the next arg (the script name from the shell shim) as its value.
  .boolean('get-yargs-completions')
  // 4-arg fallback callback: yargs auto-enumerates commands/subcommands/options
  // via `defaultCompletions`; we layer project/target completions on top for
  // known nx subcommands (run, run-many, show project/target, infix targets).
  // The 4-arg form isn't in @types/yargs but the runtime treats any callback
  // with `function.length > 3` as the fallback variant — see node_modules/yargs/
  // build/lib/completion.js (`isFallbackCompletionFunction`).
  .completion('--get-yargs-completions', false, fallbackCompletion as any)
  .scriptName('nx')
  .middleware((args) => {
    // Skip analytics during shell completion
    if (process.argv.includes('--get-yargs-completions')) {
      return;
    }
    const context = (commandsObject as any).getInternalMethods().getContext();
    const command =
      (context.commands ?? []).join(' ') ||
      (args._ ?? []).slice(0, 1).join(' ');
    if (command) {
      reportCommandRunEvent(command, undefined, args);
    }
  })
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
