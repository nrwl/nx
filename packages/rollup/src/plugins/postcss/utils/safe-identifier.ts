/**
 * Convert a CSS class name to a valid JavaScript identifier
 * This is used when generating exports for CSS modules
 */

/**
 * Reserved JavaScript keywords that cannot be used as identifiers
 */
const RESERVED_WORDS = new Set([
  'break',
  'case',
  'catch',
  'continue',
  'debugger',
  'default',
  'delete',
  'do',
  'else',
  'finally',
  'for',
  'function',
  'if',
  'in',
  'instanceof',
  'new',
  'return',
  'switch',
  'this',
  'throw',
  'try',
  'typeof',
  'var',
  'void',
  'while',
  'with',
  'class',
  'const',
  'enum',
  'export',
  'extends',
  'import',
  'super',
  'implements',
  'interface',
  'let',
  'package',
  'private',
  'protected',
  'public',
  'static',
  'yield',
  'null',
  'true',
  'false',
]);

/**
 * Check if a string starts with a digit
 */
function startsWithDigit(str: string): boolean {
  return /^\d/.test(str);
}

/**
 * Escape dashes in class names to make them valid JS identifiers
 * e.g., "my-class" -> "myClass"
 */
export function escapeClassNameDashes(name: string): string {
  return name.replace(/-+(\w)/g, (_, char) => char.toUpperCase());
}

/**
 * Convert a CSS class name to a safe JavaScript identifier
 */
export function safeIdentifier(name: string): string {
  // First escape dashes
  let safeName = escapeClassNameDashes(name);

  // If it starts with a digit, prefix with underscore
  if (startsWithDigit(safeName)) {
    safeName = '_' + safeName;
  }

  // If it's a reserved word, prefix with underscore
  if (RESERVED_WORDS.has(safeName)) {
    safeName = '_' + safeName;
  }

  // Replace any remaining invalid characters with underscores
  safeName = safeName.replace(/[^a-zA-Z0-9_$]/g, '_');

  return safeName;
}
