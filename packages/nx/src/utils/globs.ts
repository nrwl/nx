export const combineGlobPatterns = (patterns: string[]) =>
  patterns.length > 1
    ? '{' + patterns.join(',') + '}'
    : patterns.length === 1
    ? patterns[0]
    : '';
