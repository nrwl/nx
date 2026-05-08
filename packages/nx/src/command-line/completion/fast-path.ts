/**
 * Fast path for shell tab-completion. When the matched command path has
 * registered metadata, we resolve completions without loading the full
 * yargs command surface (`nx-commands.ts` and the 35 command-object files
 * it imports). The bin shortcut consults this first, then falls back to
 * the slow path (yargs default completion via `commandsObject.argv`) only
 * when this returns false.
 */

import './registrations';
import { findCompletionMetadata, findFlagCompletion } from './metadata';

/**
 * Try to emit completions from the metadata registry. Returns true if
 * we handled the request (caller should exit), false if the caller
 * should fall through to the slow path.
 */
export function tryFastCompletion(): boolean {
  const idx = process.argv.indexOf('--get-yargs-completions');
  if (idx === -1) return false;

  // Layout: [..., '--get-yargs-completions', 'nx', ...userTokens, currentPartial]
  const tail = process.argv.slice(idx + 1);
  const cleaned = tail[0] === 'nx' ? tail.slice(1) : tail;
  if (cleaned.length === 0) return false;

  const current = cleaned[cleaned.length - 1] ?? '';
  // The trailing partial is what the user is typing; everything else
  // is locked-in args we've already past.
  const previousToken = cleaned.length >= 2 ? cleaned[cleaned.length - 2] : '';

  const completions = computeCompletions(current, cleaned, previousToken);
  if (completions === null) return false;

  for (const line of completions) {
    process.stdout.write(line + '\n');
  }
  return true;
}

function computeCompletions(
  current: string,
  args: string[],
  previousToken: string
): string[] | null {
  if (args.length === 0) return null;

  const match = findCompletionMetadata(args);
  const meta = match?.metadata ?? null;

  // 1. Flag-based: did the user just type `--focus <TAB>`?
  if (previousToken.startsWith('-')) {
    const flag = previousToken.replace(/^-+/, '');
    const handler = findFlagCompletion(meta, flag);
    if (handler) return handler(current, args);
  }

  // 2. Positional: which positional is the user on?
  if (match) {
    const positional = match.metadata.positionals?.[match.positionalIndex];
    if (positional?.complete) return positional.complete(current, args);
    if (positional?.choices) {
      return positional.choices.filter((c) => c.startsWith(current));
    }
    // Past all declared positionals → the slow path handles flag-name
    // suggestions via yargs.
    return null;
  }

  // No metadata for this command path. Slow path handles top-level
  // command enumeration and any unmigrated commands.
  return null;
}
