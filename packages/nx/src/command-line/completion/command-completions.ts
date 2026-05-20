// Slow-path completion: command/subcommand/flag names. Runs after
// tryValueCompletion has nothing to offer.

import { getCompletionShell } from './trigger';
import { parseCompletionArgs } from './argv-layout';
import { getRegisteredTopLevelPaths } from './metadata';
import { getNxCommandHandlers, introspectBuilder } from './command-handlers';

/** Slow-path entry point. Returns true if anything was emitted. */
export function tryCommandSurfaceCompletion(
  argv: readonly string[] = process.argv
): boolean {
  const parsed = parseCompletionArgs(argv);
  if (parsed === null) return false;

  const matched = getCommandCompletions(parsed.current, parsed.tokens);
  const completions =
    matched !== null
      ? matched
      : getTopLevelCommands(parsed.current, shellRendersDescriptions());

  if (completions === null || completions.length === 0) return false;

  for (const line of completions) {
    console.log(line);
  }
  return true;
}

/** Top-level command names. Unions yargs handlers with the completion
 *  registry's single-token paths (infix targets). */
export function getTopLevelCommands(
  current: string,
  withDesc: boolean
): string[] | null {
  const handlers = getNxCommandHandlers();

  const seen = new Set<string>();
  const completions: string[] = [];
  for (const name of Object.keys(handlers)) {
    if (name === '$0' || name.startsWith('_')) continue;
    if (current && !name.startsWith(current)) continue;
    const handler = handlers[name];
    if (handler?.description === false) continue; // hidden
    seen.add(name);
    const desc = withDesc ? formatDescription(handler?.description) : '';
    completions.push(desc ? `${name}${DESC_SEPARATOR}${desc}` : name);
  }

  // Infix targets + any other top-level completion-only paths.
  for (const name of getRegisteredTopLevelPaths()) {
    if (seen.has(name)) continue;
    if (current && !name.startsWith(current)) continue;
    completions.push(name);
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
  const handlers = getNxCommandHandlers();
  const cmdName = args.find((a) => handlers[a]);
  if (!cmdName) {
    return null;
  }
  const handler = handlers[cmdName];
  if (typeof handler.builder !== 'function') {
    return null;
  }

  const intro = introspectBuilder(handler.builder);
  if (!intro) return null;

  const completions: string[] = [];
  const isFlagPrefix = current.startsWith('-');
  const withDesc = shellRendersDescriptions();

  if (!isFlagPrefix) {
    for (const [name, desc] of intro.subcommands) {
      const formatted = withDesc ? formatDescription(desc) : '';
      completions.push(
        formatted ? `${name}${DESC_SEPARATOR}${formatted}` : name
      );
    }
  }

  for (const [name, desc] of intro.options) {
    const formatted = withDesc ? formatDescription(desc) : '';
    completions.push(
      formatted ? `--${name}${DESC_SEPARATOR}${formatted}` : `--${name}`
    );
  }

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

/** value\tdescription separator. TAB because completion values can contain
 *  colons (`my-app:build`); descriptions get TABs collapsed. */
export const DESC_SEPARATOR = '\t';

/** Strip yargs' i18n marker and collapse stray TABs so they can't forge
 *  the value/description separator. */
export function formatDescription(raw: string | undefined): string {
  if (!raw) return '';
  return raw.replace(/^__yargsString__:/, '').replace(/\t/g, ' ');
}

/** zsh (compadd -d) and fish (complete -a) parse `value\tdescription`. */
export function shellRendersDescriptions(): boolean {
  const shell = getCompletionShell();
  return shell === 'zsh' || shell === 'fish';
}
