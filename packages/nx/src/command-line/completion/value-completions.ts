// Fast-path completion: project/target/generator/flag values, served from
// registered metadata without loading the yargs command surface.

import './registrations';
import { resolveCompletion } from './metadata';
import { parseCompletionArgs } from './argv-layout';

/** Returns true if handled — caller should not fall through. */
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
    console.log(line);
  }
  return true;
}
