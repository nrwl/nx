/**
 * Splits a combined `{a,b}` glob (from nx's combineGlobPatterns) into its
 * individual patterns. picomatch drops the `**\/` zero-segment match inside
 * brace alternation, so `{**\/a,**\/b}` misses root-level files unless split.
 * Local copy: the nx version is not available in all supported nx majors.
 * Keep in sync with packages/nx/src/utils/globs.ts.
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
