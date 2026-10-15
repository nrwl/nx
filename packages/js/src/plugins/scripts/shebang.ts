import { closeSync, openSync, readSync } from 'node:fs';
import { basename } from 'node:path';

const SNIFF_BYTES = 512;
const PACKAGE_RUNNERS = new Set(['npx', 'pnpx', 'bunx']);

export interface Shebang {
  /** Program that runs the file, e.g. `node` or `tsx`. */
  interpreter: string;
  /** Arguments that follow the interpreter on the shebang line. */
  args: string[];
}

/**
 * Returns the first bytes of a script that starts with `#!`, or `null` when it
 * has no shebang or cannot be read (e.g. a tracked broken symlink).
 */
export function readScriptHeader(absolutePath: string): string | null {
  const buffer = Buffer.alloc(SNIFF_BYTES);
  let bytesRead: number;
  try {
    const fd = openSync(absolutePath, 'r');
    try {
      bytesRead = readSync(fd, buffer, 0, SNIFF_BYTES, 0);
    } finally {
      closeSync(fd);
    }
  } catch {
    return null;
  }
  let text = stripBom(buffer.toString('utf8', 0, bytesRead));
  if (!text.startsWith('#!')) {
    return null;
  }
  // Drop a line the sniff cut off, so a directive is never read truncated.
  if (bytesRead === SNIFF_BYTES && text.includes('\n')) {
    text = text.slice(0, text.lastIndexOf('\n'));
  }
  return text;
}

/** The shebang line of a header from `readScriptHeader`, without `#!`. */
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

export function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}
