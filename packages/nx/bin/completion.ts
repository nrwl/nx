#!/usr/bin/env node

/**
 * Lightweight shell completion entry point.
 * Called by shell completion scripts instead of `nx --get-yargs-completions`.
 * Only imports fs/path — no nx modules — so it starts in ~50ms, not seconds.
 */

import { completionHandler } from '../src/command-line/completion/completion-handler';

const args = process.argv.slice(2);
// Strip script name if present (fish passes 'nx show project')
const cleanArgs = args[0] === 'nx' ? args.slice(1) : args;
const current = cleanArgs.length > 0 ? cleanArgs[cleanArgs.length - 1] : '';

completionHandler(current, { _: cleanArgs }, (completions: string[]) => {
  if (completions.length > 0) {
    process.stdout.write(completions.join('\n') + '\n');
  }
  process.exit(0);
});
