import { existsSync, readFileSync } from 'fs';

export interface NpmrcEntry {
  key: string;
  value: string;
  /** True when the source used ini's `key[]` array-append syntax. */
  array?: boolean;
}

/**
 * Parses an .npmrc file into its `key = value` entries the way npm/yarn/pnpm do
 * (via the `ini` package): skip blank lines and `#`/`;` comment lines, split on
 * the first `=` (a valueless line is a bare flag ini reads as `true`), then run
 * both sides through ini's `unsafe()` so surrounding quotes are stripped, an
 * unescaped inline `#`/`;` comment is truncated, and backslash escapes are
 * honored. Returns null when the file is missing or unreadable so callers can
 * distinguish "no file" from "file with no entries".
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
  return parseNpmrcContent(raw);
}

/** The parsing half of {@link readNpmrcEntries}, usable without a filesystem. */
export function parseNpmrcContent(raw: string): NpmrcEntry[] {
  const entries: NpmrcEntry[] = [];
  // ini breaks lines on any run of CR/LF, so a bare CR starts a new line there
  // too; splitting on `\r?\n` alone would hide everything after one from us
  // while npm still reads it.
  for (const line of raw.split(/[\r\n]+/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith(';')) {
      continue;
    }
    // A line with no `=` is a bare flag, which ini reads as `true`, not a
    // dropped line. Skipping it loses a bare `always-auth`/`strict-ssl` and
    // flips the credential/TLS decision a consumer derives from it.
    const eq = trimmed.indexOf('=');
    const rawKey = iniUnsafe(eq === -1 ? trimmed : trimmed.slice(0, eq));
    const value = eq === -1 ? 'true' : iniUnsafe(trimmed.slice(eq + 1));
    // ini (bracketedArray on by default) treats a `key[]` suffix as an array
    // append: the bare key collects each value, instead of a literal `key[]`
    // entry holding only the last one.
    if (rawKey.length > 2 && rawKey.endsWith('[]')) {
      entries.push({ key: rawKey.slice(0, -2), value, array: true });
    } else {
      entries.push({ key: rawKey, value });
    }
  }
  return entries;
}

/**
 * Reads an .npmrc-format file into a last-write-wins map (ini semantics for
 * repeated keys). Returns null when the file is missing or unreadable.
 */
export function readNpmrcMap(path: string): Map<string, string> | null {
  const entries = readNpmrcEntries(path);
  if (!entries) {
    return null;
  }
  const map = new Map<string, string>();
  for (const { key, value, array } of entries) {
    // ini collects repeated `key[]` values into an array under the bare key;
    // npm reconstructs a config array from the env by splitting on a blank
    // line, so join array values that way. Scalars stay last-write-wins.
    const existing = map.get(key);
    map.set(
      key,
      array && existing !== undefined ? `${existing}\n\n${value}` : value
    );
  }
  return map;
}

function isQuoted(val: string): boolean {
  return (
    val.length >= 2 &&
    ((val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'")))
  );
}

/**
 * Follows the `ini` package's `unsafe()`: trims, strips a single pair of
 * surrounding quotes (double-quoted is JSON-decoded), and for an unquoted value
 * stops at the first unescaped `;`/`#` (inline comment) while honoring `\`
 * escapes. ini also JSON-decodes a single-quoted value's contents; we keep them
 * verbatim, which only differs when those contents are valid JSON (never a
 * registry, token, or path).
 * See https://github.com/isaacs/ini/blob/a0c72fe9e335a3f949d734fb5ef13371a850bbe3/lib/ini.js#L230
 */
function iniUnsafe(raw: string): string {
  const val = raw.trim();
  if (isQuoted(val)) {
    if (val.startsWith("'")) {
      return val.slice(1, -1);
    }
    try {
      return JSON.parse(val);
    } catch {
      return val;
    }
  }
  let esc = false;
  let unesc = '';
  for (const c of val) {
    if (esc) {
      unesc += '\\;#'.includes(c) ? c : `\\${c}`;
      esc = false;
    } else if (c === ';' || c === '#') {
      break;
    } else if (c === '\\') {
      esc = true;
    } else {
      unesc += c;
    }
  }
  if (esc) {
    unesc += '\\';
  }
  return unesc.trim();
}
