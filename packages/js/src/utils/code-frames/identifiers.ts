// Adapted from https://raw.githubusercontent.com/babel/babel/e39b508030a9f696584d21b0eb9677498e3ca231/packages/babel-helper-validator-identifier/src/keyword.js
const keywords = new Set([
  'break',
  'case',
  'catch',
  'continue',
  'debugger',
  'default',
  'do',
  'else',
  'finally',
  'for',
  'function',
  'if',
  'return',
  'switch',
  'throw',
  'try',
  'var',
  'const',
  'while',
  'with',
  'new',
  'this',
  'super',
  'class',
  'extends',
  'export',
  'import',
  'null',
  'true',
  'false',
  'in',
  'instanceof',
  'typeof',
  'void',
  'delete',
]);

/**
 * Checks if word is a reserved word in non-strict mode
 */
export function isReservedWord(word: string, inModule?: boolean): boolean {
  return (inModule && word === 'await') || word === 'enum';
}

export function isKeyword(word: string): boolean {
  return keywords.has(word);
}
