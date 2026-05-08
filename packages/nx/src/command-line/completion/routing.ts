import { findCompletionMetadata, findFlagCompletion } from './metadata';

// Eager-import the lightweight registrations barrel so each command's
// `registerCompletion` side-effect runs before the first lookup. This
// is much cheaper than loading the full nx-commands surface — only
// the metadata helpers and providers each command needs.
require('./registrations');

/**
 * Returns project/target completions for known nx subcommands. Returns null
 * when the routing has nothing specific to add — the caller should fall back
 * to yargs's default command/option enumeration.
 */
export function getCompletions(
  current: string,
  args: string[]
): string[] | null {
  if (args.length === 0) {
    return null;
  }

  const match = findCompletionMetadata(args);
  const meta = match?.metadata ?? null;

  // 1. Flag-based completion: did the user just type `--focus <TAB>` etc.?
  const activeFlag = stripDashes(getActiveOptionFlag());
  if (activeFlag) {
    const handler = findFlagCompletion(meta, activeFlag);
    if (handler) {
      return handler(current, args);
    }
  }

  // 2. Positional completion: which positional is the user typing?
  if (match) {
    const positional = match.metadata.positionals?.[match.positionalIndex];
    if (positional?.complete) {
      return positional.complete(current, args);
    }
    if (positional?.choices) {
      return positional.choices.filter((c) => c.startsWith(current));
    }
    // Past all declared positionals — fall through to flag completion.
    return null;
  }

  // No matching metadata — fall through to yargs's command/option defaults.
  return null;
}

/**
 * Heuristic: the last explicit token before `current` (process.argv's
 * trailing entry) is the flag whose value the user is typing.
 */
function getActiveOptionFlag(): string | undefined {
  const rawArgs = process.argv;
  return rawArgs[rawArgs.length - 2];
}

function stripDashes(flag: string | undefined): string | null {
  if (!flag || !flag.startsWith('-')) return null;
  return flag.replace(/^-+/, '');
}

/**
 * Returns subcommand + option completions for a matched top-level command.
 * Bypasses yargs's `defaultCompletion` because its recursion (`reset()` +
 * `builder(y, true)` + `y.argv`) wipes our `.boolean('get-yargs-completions')`
 * declaration on the inner instance, which can break the inner parse and
 * cause yargs to print help text instead of emitting completions (observed
 * for `run-many` and `affected`).
 *
 * Returns null when no top-level command is matched in `args` — yargs's
 * defaultCompletion handles top-level command-name completion (no recursion).
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
function formatDescription(raw: string | undefined): string {
  if (!raw) return '';
  return raw.replace(/^__yargsString__:/, '').replace(/:/g, '\\:');
}

function isZshShell(): boolean {
  return Boolean(
    process.env.SHELL?.includes('zsh') || process.env.ZSH_NAME?.includes('zsh')
  );
}
