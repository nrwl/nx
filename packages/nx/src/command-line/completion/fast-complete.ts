import { getCompletions } from './completion-handler';

/**
 * Shell tab-completion entry point.
 *
 * Called from `bin/nx.ts` when `--get-yargs-completions` is present, before
 * any Nx init (workspace-root detection, dotenv, daemon, native module) runs.
 *
 * Routing:
 *   1. Try `getCompletions` for dynamic project/target suggestions — these
 *      never need the yargs command tree, so this path stays lightweight.
 *   2. Fall back to enumerating yargs's registered commands/subcommands for
 *      generic `nx <TAB>` / `nx <cmd> <TAB>` completion. Walking via yargs's
 *      internal API keeps the list zero-drift — anything registered in
 *      `nx-commands.ts` is completable.
 *
 * We don't call `commandsObject.getCompletion(args, done)` because it runs
 * `yargs.parse(args, true)` internally, which can trigger `demandCommand`
 * help output instead of returning suggestions.
 */
export function runFastCompletion(): void {
  try {
    const flagIdx = process.argv.indexOf('--get-yargs-completions');
    const tokens = flagIdx >= 0 ? process.argv.slice(flagIdx + 1) : [];

    // tokens[0] is the script name ("nx"), last token is the word being
    // completed, everything in between is what has been typed so far.
    const current = tokens.length > 0 ? tokens[tokens.length - 1] : '';
    const args = tokens.slice(1, -1);

    let completions = getCompletions(current, args);
    if (completions === null) {
      completions = getCommandTreeCompletions(args, current);
    }

    if (completions && completions.length > 0) {
      process.stdout.write(completions.join('\n') + '\n');
    }
  } catch {
    // Silent: completion must never surface errors to the shell.
  }
  process.exit(0);
}

/**
 * Returns command or subcommand names that match `current`, walking yargs's
 * registered command tree instead of using a hardcoded list.
 *
 * - `args.length === 0` → top-level commands (e.g. `run`, `show`, `release`).
 * - `args.length === 1` → subcommands of `args[0]` by calling the parent's
 *   `builder` on a throwaway yargs instance and enumerating what it
 *   registers (e.g. `show` → `project`, `projects`, `target`).
 */
function getCommandTreeCompletions(
  args: string[],
  current: string
): string[] | null {
  if (args.length > 1) {
    return null;
  }

  // Perf mark consumed by perf-logging; set before requiring nx-commands to
  // avoid a spurious "init-local mark not set" error.
  require('perf_hooks').performance.mark('init-local');

  const { commandsObject } = require('../nx-commands');
  const handlers = commandsObject
    .getInternalMethods()
    .getCommandInstance()
    .getCommandHandlers();

  if (args.length === 0) {
    return filterByPrefix(Object.keys(handlers), current);
  }

  // args.length === 1 — subcommands of args[0]
  const parent = handlers[args[0]];
  if (!parent?.builder || typeof parent.builder !== 'function') {
    return null;
  }
  const yargs = require('yargs');
  const temp = yargs();
  try {
    parent.builder(temp);
  } catch {
    return null;
  }
  const subs = Object.keys(
    temp.getInternalMethods().getCommandInstance().getCommandHandlers()
    // Strip yargs's '$0' default-command marker.
  ).filter((name) => name !== '$0');
  return filterByPrefix(subs, current);
}

function filterByPrefix(values: string[], prefix: string): string[] {
  return prefix ? values.filter((v) => v.startsWith(prefix)) : values;
}
