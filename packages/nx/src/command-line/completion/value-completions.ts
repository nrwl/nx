/**
 * Value completions: project names, target names, generator names,
 * and flag values (e.g. `nx affected --focus <project>`).
 *
 * `tryValueCompletion` is the bin-entry fast path — runs before the full
 * yargs surface loads. Reads argv directly, writes to stdout, returns
 * true if handled so the caller can exit.
 */

import './registrations';
import { resolveCompletion } from './metadata';
import { parseCompletionArgs } from './argv-layout';

/**
 * Bin entry point. Returns true if value completion handled the request
 * (caller should exit), false to fall through to command-surface completion.
 */
export function tryValueCompletion(): boolean {
  const parsed = parseCompletionArgs();
  if (parsed === null) return false;

  const completions = resolveCompletion(
    parsed.tokens,
    parsed.current,
    parsed.previousToken
  );
  if (completions === null) return false;

  for (const line of completions) {
    process.stdout.write(line + '\n');
  }
  return true;
}
