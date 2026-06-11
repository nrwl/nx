import { existsSync, readFileSync } from 'fs';

export interface NpmrcEntry {
  key: string;
  value: string;
}

/**
 * Parses an .npmrc file into its `key = value` entries the way npm/npm-conf do:
 * skip blank lines and `#`/`;` comments, split on the first `=`, and trim both
 * sides. The value is returned raw (quote stripping is the caller's concern).
 * Returns null when the file is missing or unreadable so callers can distinguish
 * "no file" from "file with no relevant keys". Shared by the npm and pnpm
 * cooldown readers.
 */
export function readNpmrcEntries(path: string): NpmrcEntry[] | null {
  if (!existsSync(path)) {
    return null;
  }
  let raw: string;
  try {
    raw = readFileSync(path, 'utf-8');
  } catch {
    return null;
  }
  const entries: NpmrcEntry[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith(';')) {
      continue;
    }
    const eq = trimmed.indexOf('=');
    if (eq === -1) {
      continue;
    }
    entries.push({
      key: trimmed.slice(0, eq).trim(),
      value: trimmed.slice(eq + 1).trim(),
    });
  }
  return entries;
}
