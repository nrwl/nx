export function combineGlobPatterns(...patterns: (string | string[])[]) {
  const p = patterns.flat();
  return p.length > 1 ? '{' + p.join(',') + '}' : p.length === 1 ? p[0] : '';
}
