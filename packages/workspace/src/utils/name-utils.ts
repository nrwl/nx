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
  fileName: string;
} {
  return {
    name,
    className: toClassName(name),
    propertyName: toPropertyName(name),
    fileName: toFileName(name),
  };
}

/**
 * hypenated to UpperCamelCase
 */
export function toClassName(str: string): string {
  return toCapitalCase(toPropertyName(str));
}

/**
 * Hypenated to lowerCamelCase
 */
export function toPropertyName(s: string): string {
  return s
    .replace(/(-|_|\.|\s)+(.)?/g, (_, __, chr) =>
      chr ? chr.toUpperCase() : ''
    )
    .replace(/[^a-zA-Z\d]/g, '')
    .replace(/^([A-Z])/, (m) => m.toLowerCase());
}

/**
 * Upper camelCase to lowercase, hypenated
 */
export function toFileName(s: string): string {
  return s
    .replace(/([a-z\d])([A-Z])/g, '$1_$2')
    .toLowerCase()
    .replace(/[ _]/g, '-');
}

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
