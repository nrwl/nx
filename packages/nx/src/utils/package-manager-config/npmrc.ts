import { readFileSync } from 'fs';

export interface NpmrcEntry {
  key: string;
  value: string;
  /** True when the source used ini's `key[]` array-append syntax. */
  array?: boolean;
}

/**
 * Parses an .npmrc file into its `key = value` entries the way npm/yarn/pnpm do
 * (via the `ini` package). Returns null when the file is missing, and
 * 'unreadable' when it exists but cannot be read (permissions, a directory):
 * package managers diverge on that state, so each caller decides whether to
 * skip, warn, or abort rather than having it collapsed into "absent" here.
 */
export function readNpmrcEntries(
  path: string
): NpmrcEntry[] | 'unreadable' | null {
  let raw: string;
  try {
    raw = readFileSync(path, 'utf-8');
  } catch (e) {
    // ENOTDIR (a path through a non-directory) is another shape of absent, not an
    // unreadable file.
    return e?.code === 'ENOENT' || e?.code === 'ENOTDIR' ? null : 'unreadable';
  }
  return parseNpmrcContent(raw);
}

export function parseNpmrcContent(raw: string): NpmrcEntry[] {
  const entries: NpmrcEntry[] = [];
  // ini breaks lines on any run of CR/LF, so splitting on `\r?\n` here would
  // hide everything after a bare CR that npm still reads.
  for (const line of raw.split(/[\r\n]+/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith(';')) {
      continue;
    }
    // ini matches the header on the raw line, so an indented one stays a literal
    // bare-flag key. Everything after a header nests under it, out of npm's flat
    // lookup, so stop here.
    if (/^\[[^\]]*\]\s*$/.test(line)) {
      break;
    }
    // ini reads a valueless line as the flag `true`; dropping it would lose a bare
    // `always-auth`/`strict-ssl` and flip the credential/TLS decision built on it.
    const eq = trimmed.indexOf('=');
    const rawKey = iniUnsafe(eq === -1 ? trimmed : trimmed.slice(0, eq));
    const value = eq === -1 ? 'true' : iniUnsafe(trimmed.slice(eq + 1));
    // ini enables bracketedArray by default, so a `key[]` suffix appends under the
    // bare key instead of making a literal `key[]` entry.
    if (rawKey.length > 2 && rawKey.endsWith('[]')) {
      entries.push({ key: rawKey.slice(0, -2), value, array: true });
    } else {
      entries.push({ key: rawKey, value });
    }
  }
  return entries;
}

/**
 * Reads an .npmrc-format file into a map with ini's semantics for repeated
 * keys: scalars last-write-wins, `key[]` values joined. Null and 'unreadable'
 * pass through from {@link readNpmrcEntries}.
 */
export function readNpmrcMap(
  path: string
): Map<string, string> | 'unreadable' | null {
  const entries = readNpmrcEntries(path);
  return Array.isArray(entries) ? npmrcEntriesToMap(entries) : entries;
}

/** Those entries under ini's semantics for repeated keys. */
export function npmrcEntriesToMap(entries: NpmrcEntry[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const { key, value, array } of entries) {
    // ini collects repeated `key[]` values into an array under the bare key, and
    // npm rebuilds a config array from the env by splitting on a blank line, so
    // join them that way.
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
 * Mirrors the `ini` package's `unsafe()`, except that ini JSON-decodes a
 * single-quoted value's contents and we keep them verbatim; that only differs
 * when the contents are valid JSON, never true for a registry, token, or path.
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
