/**
 * Value completions: project names, target names, generator names,
 * and flag values (e.g. `nx affected --focus <project>`).
 *
 * Two entry points share the same dispatcher (`resolveCompletion` in
 * metadata.ts). They differ only in how they receive their inputs:
 *
 *   - tryValueCompletion: bin/nx.ts entry. Runs before the full yargs
 *     surface loads. Reads argv directly, writes to stdout, returns
 *     true if handled so the caller can exit.
 *   - getValueCompletions: yargs `.completion()` fallback entry. Gets
 *     `current` and the parsed positionals from yargs; reads
 *     `previousToken` from process.argv because yargs strips the flag
 *     from its parsed `_`. Returns string[] | null.
 */

import './registrations';
import { resolveCompletion } from './metadata';

/**
 * Bin entry point. Returns true if value completion handled the request
 * (caller should exit), false to fall through to the full yargs surface.
 */
export function tryValueCompletion(): boolean {
  const idx = process.argv.indexOf('--get-yargs-completions');
  if (idx === -1) return false;

  // Layout: [..., '--get-yargs-completions', 'nx', ...userTokens, currentPartial]
  const tail = process.argv.slice(idx + 1);
  const cleaned = tail[0] === 'nx' ? tail.slice(1) : tail;
  if (cleaned.length === 0) return false;

  const current = cleaned[cleaned.length - 1] ?? '';
  const previousToken = cleaned.length >= 2 ? cleaned[cleaned.length - 2] : '';

  const completions = resolveCompletion(cleaned, current, previousToken);
  if (completions === null) return false;

  for (const line of completions) {
    process.stdout.write(line + '\n');
  }
  return true;
}

/**
 * Yargs-fallback entry point. Returns null when nothing applies so the
 * caller can fall through to command/option-name completion and finally
 * yargs's defaults.
 */
export function getValueCompletions(
  current: string,
  args: string[]
): string[] | null {
  const previousToken = process.argv[process.argv.length - 2] ?? '';
  return resolveCompletion(args, current, previousToken);
}
