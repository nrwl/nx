/**
 * Command-surface completion: top-level command names, subcommand names,
 * and flag names. Used as the slow-path fallback after the metadata-driven
 * fast path (`tryValueCompletion`) returns null.
 *
 * Two entry points are exported:
 *   - `tryCommandSurfaceCompletion()` — bin-entry: parses argv, dispatches
 *     between matched-command and top-level enumeration, writes stdout.
 *   - `getCommandCompletions(current, args)` — programmatic entry: returns
 *     completions for a matched top-level command (subcommands + options).
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
      : getTopLevelCommands(parsed.current, isZshShell());

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
  isZsh: boolean
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
    const desc = isZsh ? formatDescription(handler?.description) : '';
    completions.push(desc ? `${name}:${desc}` : name);
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
  // Only zsh's `_describe` parses the `name:description` format. Bash's
  // `compgen -W` would insert the whole `name:description` literal as the
  // completion text — so omit descriptions when not running under zsh.
  const isZsh = isZshShell();

  // Subcommands: only relevant when user isn't typing a flag.
  if (!isFlagPrefix) {
    const subUsage = temp.getInternalMethods().getUsageInstance();
    for (const [usagePattern, desc] of subUsage.getCommands()) {
      // usagePattern is like "project [projectName]" — first token is the name.
      const subName = String(usagePattern).split(/\s+/)[0];
      if (subName === '$0') continue;
      const formatted = isZsh ? formatDescription(desc as string) : '';
      completions.push(formatted ? `${subName}:${formatted}` : subName);
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
    const desc = isZsh ? formatDescription(descriptions[k]) : '';
    completions.push(desc ? `--${k}:${desc}` : `--${k}`);
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

// Yargs prefixes some descriptions with `__yargsString__:` (its i18n marker).
// Strip that and any literal colons inside descriptions (which would confuse
// the `name:description` shell-completion format).
export function formatDescription(raw: string | undefined): string {
  if (!raw) return '';
  return raw.replace(/^__yargsString__:/, '').replace(/:/g, '\\:');
}

export function isZshShell(): boolean {
  return getCompletionShell() === 'zsh';
}
