import { basename } from 'node:path';

const PACKAGE_RUNNERS = new Set(['npx', 'pnpx', 'bunx']);

export interface Shebang {
  /** Program that runs the file, e.g. `node` or `tsx`. */
  interpreter: string;
  /** Arguments that follow the interpreter on the shebang line. */
  args: string[];
}

/** The shebang line of a header from the workspace context, without `#!`. */
export function getShebangLine(header: string): string {
  const end = header.search(/\r?\n/);
  return (end === -1 ? header : header.slice(0, end)).slice(2).trim();
}

/**
 * Handles `/usr/bin/env node`, `/usr/bin/env -S node --flags`,
 * `/usr/bin/env -S npx tsx` and direct paths such as `/usr/local/bin/node`.
 */
export function parseShebang(line: string): Shebang | null {
  let tokens = line.split(/\s+/).filter(Boolean);
  if (tokens.length && basename(tokens[0]) === 'env') {
    tokens = tokens.slice(1);
    if (tokens[0] === '-S') {
      tokens = tokens.slice(1);
    }
  }
  if (tokens.length && PACKAGE_RUNNERS.has(basename(tokens[0]))) {
    tokens = tokens.slice(1);
  }
  if (!tokens.length) {
    return null;
  }
  return { interpreter: basename(tokens[0]), args: tokens.slice(1) };
}
