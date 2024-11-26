export function combineGlobPatterns(...patterns: (string | string[])[]) {
  const p = patterns.flat();
  return p.length > 1 ? '{' + p.join(',') + '}' : p.length === 1 ? p[0] : '';
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
