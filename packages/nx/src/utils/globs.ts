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
    // never emit an empty pattern - picomatch throws on '', where minimatch
    // matched nothing
    return pattern ? [pattern] : [];
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
  return parts.filter(Boolean);
}

/**
 * Expands every `{a,b}` alternation into one pattern per combination
 * (`x/{a,b}/z` -> `x/a/z`, `x/b/z`). picomatch drops the `**\/` zero-segment
 * match inside brace alternation, so `x/{**\/*.ts,**\/*.tsx}` misses
 * `x/index.ts` unless expanded. Groups with no top-level comma (`{1..3}`,
 * `{projectRoot}`), escaped braces (`\{a,b\}`) and unbalanced braces are left
 * alone, so results are not necessarily brace-free. Output size is the product
 * of the alternation widths, and an empty alternative yields an empty pattern
 * (`{,a}` -> `['', 'a']`) which picomatch rejects - callers must drop those.
 */
export function expandGlobPatternBraces(pattern: string): string[] {
  let search = 0;
  while (search < pattern.length) {
    let open = -1;
    let depth = 0;
    let close = -1;
    const commas: number[] = [];
    for (let i = search; i < pattern.length; i++) {
      const c = pattern[i];
      // a backslash escapes the next character, so it opens/closes nothing
      if (c === '\\') {
        i++;
      } else if (c === '{') {
        if (open === -1) {
          open = i;
        }
        depth++;
      } else if (c === '}' && open !== -1) {
        if (--depth === 0) {
          close = i;
          break;
        }
      } else if (c === ',' && depth === 1) {
        commas.push(i);
      }
    }
    // no group left, or an unbalanced one - nothing further is safe to expand
    if (open === -1 || close === -1) {
      return [pattern];
    }
    // not an alternation (a range, or a `{token}`) - look past it
    if (!commas.length) {
      search = close + 1;
      continue;
    }
    const prefix = pattern.slice(0, open);
    const suffix = pattern.slice(close + 1);
    const bounds = [open, ...commas, close];
    const results: string[] = [];
    for (let i = 0; i < bounds.length - 1; i++) {
      const part = pattern.slice(bounds[i] + 1, bounds[i + 1]);
      // a loop rather than push(...spread) - the spread hits the argument
      // limit and reports a misleading RangeError on large products
      for (const expanded of expandGlobPatternBraces(prefix + part + suffix)) {
        results.push(expanded);
      }
    }
    return results;
  }
  return [pattern];
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
