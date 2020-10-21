import * as path from 'path';

/**
 * Build dictionary of names:
 */
export function names(
  name: string
): {
  name: string;
  className: string;
  propertyName: string;
  constantName: string;
  fileName: string;
} {
  return {
    name,
    className: toClassName(name),
    propertyName: toPropertyName(name),
    constantName: toConstantName(name),
    fileName: toFileName(name),
  };
}

/**
 * Hyphenated to UpperCamelCase
 */
export function toClassName(str: string): string {
  return toCapitalCase(toPropertyName(str));
}

/**
 * Hyphenated to lowerCamelCase
 */
export function toPropertyName(s: string): string {
  return s
    .replace(/(-|_|\.|\s)+(.)?/g, (_, __, chr) =>
      chr ? chr.toUpperCase() : ''
    )
    .replace(/^([A-Z])/, (m) => m.toLowerCase());
}

/**
 * Hyphenated to CONSTANT_CASE
 */
function toConstantName(s: string): string {
  return s.replace(/(-|_|\.|\s)/g, '_').toUpperCase();
}

/**
 * Upper camelCase to lowercase, hyphenated
 */
export function toFileName(s: string): string {
  return s
    .replace(/([a-z\d])([A-Z])/g, '$1_$2')
    .toLowerCase()
    .replace(/[ _]/g, '-');
}

/**
 * Capitalizes the first letter of a string
 */
function toCapitalCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.substr(1);
}

/**
 * Determine the parent directory for the ngModule specified
 * in the full-path option 'module'
 */
export function findModuleParent(modulePath) {
  return path.dirname(modulePath);
}
