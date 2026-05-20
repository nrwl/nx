/**
 * Command-surface completion: top-level command names, subcommand names,
 * and flag names. Used as the slow-path fallback after the metadata-driven
 * fast path (`tryValueCompletion`) returns null.
 *
 * `tryCommandSurfaceCompletion()` is the bin entry point: it parses argv and
 * dispatches between matched-command enumeration (`getCommandCompletions`)
 * and top-level command enumeration (`getTopLevelCommands`), then writes the
 * result to stdout. The latter two are internal helpers, exported only so
 * they can be unit-tested.
 */

import { getCompletionShell } from './trigger';
import { parseCompletionArgs } from './argv-layout';

/**
 * Bin entry point for command-surface (slow path) completion. Returns true
 * if it emitted anything, false if there was nothing to suggest.
 */
export function tryCommandSurfaceCompletion(): boolean {
  const parsed = parseCompletionArgs();
  if (parsed === null) return false;

  const matched = getCommandCompletions(parsed.current, parsed.tokens);
  const completions =
    matched !== null
      ? matched
      : getTopLevelCommands(parsed.current, shellRendersDescriptions());

  if (completions === null || completions.length === 0) return false;

  for (const line of completions) {
    process.stdout.write(line + '\n');
  }
  return true;
}

/**
 * Top-level command enumeration. Walks the registered top-level command
 * handlers and emits the matching names (with descriptions in zsh).
 * Replaces what yargs's `defaultCompletions` used to do for `nx <TAB>`.
 */
export function getTopLevelCommands(
  current: string,
  withDesc: boolean
): string[] | null {
  const { commandsObject } = require('../nx-commands') as {
    commandsObject: any;
  };
  const handlers = commandsObject
    .getInternalMethods()
    .getCommandInstance()
    .getCommandHandlers();

  const completions: string[] = [];
  for (const name of Object.keys(handlers)) {
    if (name === '$0' || name.startsWith('_')) continue;
    if (current && !name.startsWith(current)) continue;
    const handler = handlers[name];
    if (handler?.description === false) continue; // hidden
    const desc = withDesc ? formatDescription(handler?.description) : '';
    completions.push(desc ? `${name}${DESC_SEPARATOR}${desc}` : name);
  }
  return completions;
}

/**
 * Enumerates subcommands + options of a matched top-level command. Returns
 * null when no top-level command name is matched in `args`.
 */
export function getCommandCompletions(
  current: string,
  args: string[]
): string[] | null {
  // Lazy require to avoid circular dependency with nx-commands.
  const { commandsObject } = require('../nx-commands') as {
    commandsObject: any;
  };
  const handlers = commandsObject
    .getInternalMethods()
    .getCommandInstance()
    .getCommandHandlers();

  const cmdName = args.find((a) => handlers[a]);
  if (!cmdName) {
    return null;
  }
  const handler = handlers[cmdName];
  if (typeof handler.builder !== 'function') {
    return null;
  }

  // Build a fresh yargs instance, run the matched command's builder, and read
  // its registered subcommands + options. We don't access `.argv` on the temp
  // instance — that would trigger parse and the help-printing path we're
  // avoiding.
  const yargs = require('yargs') as typeof import('yargs');
  const temp: any = (yargs as any)();
  try {
    handler.builder(temp);
  } catch {
    return null;
  }

  const completions: string[] = [];
  const isFlagPrefix = current.startsWith('-');
  // Descriptions are emitted for shells that render them (zsh's compadd -d
  // and fish's native value\tdescription parsing). bash and powershell get
  // bare names. See DESC_SEPARATOR.
  const withDesc = shellRendersDescriptions();

  // Subcommands: only relevant when user isn't typing a flag.
  if (!isFlagPrefix) {
    const subUsage = temp.getInternalMethods().getUsageInstance();
    for (const [usagePattern, desc] of subUsage.getCommands()) {
      // usagePattern is like "project [projectName]" — first token is the name.
      const subName = String(usagePattern).split(/\s+/)[0];
      if (subName === '$0') continue;
      const formatted = withDesc ? formatDescription(desc as string) : '';
      completions.push(
        formatted ? `${subName}${DESC_SEPARATOR}${formatted}` : subName
      );
    }
  }

  // Options: always relevant.
  const opts = temp.getOptions();
  const descriptions = temp
    .getInternalMethods()
    .getUsageInstance()
    .getDescriptions();
  for (const k of Object.keys(opts.key ?? {})) {
    if ((opts.hiddenOptions ?? []).includes(k)) continue;
    const desc = withDesc ? formatDescription(descriptions[k]) : '';
    completions.push(desc ? `--${k}${DESC_SEPARATOR}${desc}` : `--${k}`);
  }

  // Filter by current prefix.
  if (!current) {
    return completions;
  }
  const flagName = current.replace(/^-+/, '');
  return completions.filter((c) => {
    if (isFlagPrefix) {
      return c.startsWith(`--${flagName}`);
    }
    return c.startsWith(current);
  });
}

/**
 * Separator between a completion value and its description in zsh output.
 * A TAB is used (not a colon) because command names and completion values
 * can themselves contain colons (`format:check`, `my-app:build`) — a colon
 * separator is ambiguous, a TAB is not (no name or description contains
 * one). The zsh wrapper splits each line on this TAB and feeds the parts to
 * `compadd -d` so values are inserted literally and descriptions displayed.
 */
export const DESC_SEPARATOR = '\t';

// Yargs prefixes some descriptions with `__yargsString__:` (its i18n marker).
// Strip that. Colons need no escaping — the value/description separator is a
// TAB. A literal TAB inside a description WOULD break the split, so collapse
// any to a space (defensive: nx's own descriptions have none, but a plugin's
// command description is not under our control).
export function formatDescription(raw: string | undefined): string {
  if (!raw) return '';
  return raw.replace(/^__yargsString__:/, '').replace(/\t/g, ' ');
}

/**
 * True when the active shell renders per-completion descriptions. zsh
 * parses `value\tdescription` via the wrapper's `compadd -d`; fish does
 * the same natively via `complete -a`. bash has no description protocol
 * for `compgen -W`, and the PowerShell wrapper uses the single-arg
 * `CompletionResult` constructor.
 */
export function shellRendersDescriptions(): boolean {
  const shell = getCompletionShell();
  return shell === 'zsh' || shell === 'fish';
}
