export function combineGlobPatterns(...patterns: (string | string[])[]) {
  const p = patterns.flat();
  return p.length > 1 ? '{' + p.join(',') + '}' : p.length === 1 ? p[0] : '';
}

/**
 * Splits a combined `{a,b}` glob (from {@link combineGlobPatterns}) into its
 * individual patterns. picomatch drops the `**\/` zero-segment match inside
 * brace alternation, so `{**\/a,**\/b}` misses root-level files unless split.
 */
export function splitGlobPatterns(pattern: string): string[] {
  if (!pattern.startsWith('{') || !pattern.endsWith('}')) {
    return [pattern];
  }
  const inner = pattern.slice(1, -1);
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < inner.length; i++) {
    const c = inner[i];
    if (c === '{') {
      depth++;
    } else if (c === '}') {
      // outer brace closes mid-pattern (e.g. `{a,b}/{c,d}`) - not combined
      if (--depth < 0) return [pattern];
    } else if (c === ',' && depth === 0) {
      parts.push(inner.slice(start, i));
      start = i + 1;
    }
  }
  if (depth !== 0) return [pattern];
  parts.push(inner.slice(start));
  return parts;
}

/**
 * Expands `{a,b}` alternations into separate brace-free patterns
 * (`x/{a,b}/z` -> `x/a/z`, `x/b/z`). picomatch drops the `**\/` zero-segment
 * match inside brace alternation, so `x/{**\/*.ts,**\/*.tsx}` misses
 * `x/index.ts` unless expanded. Range groups (`{1..3}`) are left alone.
 */
export function expandGlobPatternBraces(pattern: string): string[] {
  const open = pattern.indexOf('{');
  if (open === -1) {
    return [pattern];
  }
  let depth = 0;
  let close = -1;
  const commas: number[] = [];
  for (let i = open; i < pattern.length; i++) {
    const c = pattern[i];
    if (c === '{') {
      depth++;
    } else if (c === '}') {
      if (--depth === 0) {
        close = i;
        break;
      }
    } else if (c === ',' && depth === 1) {
      commas.push(i);
    }
  }
  // unbalanced braces or no alternation to expand
  if (close === -1 || !commas.length) {
    return [pattern];
  }
  const prefix = pattern.slice(0, open);
  const suffix = pattern.slice(close + 1);
  const bounds = [open, ...commas, close];
  const results: string[] = [];
  for (let i = 0; i < bounds.length - 1; i++) {
    const part = pattern.slice(bounds[i] + 1, bounds[i + 1]);
    results.push(...expandGlobPatternBraces(prefix + part + suffix));
  }
  return results;
}

export const GLOB_CHARACTERS = new Set(['*', '|', '{', '}', '(', ')', '[']);

export function isGlobPattern(pattern: string) {
  for (const c of pattern) {
    if (GLOB_CHARACTERS.has(c)) {
      return true;
    }
  }
  return false;
}
