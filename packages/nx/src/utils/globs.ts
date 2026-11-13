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

const GLOB_METACHARACTERS = /[\\*?[\]{}()!]/g;

/**
 * Escapes glob syntax in a path so it matches only itself. Keep the
 * character set in step with `escape_glob_literal` in `native/glob.rs`.
 */
export function escapeGlob(path: string): string {
  return path.replace(GLOB_METACHARACTERS, '\\$&');
}
