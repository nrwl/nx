/**
 * Normalize file path to use forward slashes (POSIX style)
 * This ensures consistent path handling across Windows and Unix systems
 */
export function normalizePath(path: string | undefined): string {
  if (!path) {
    return '';
  }
  return path.replace(/\\+/g, '/');
}

/**
 * Convert an absolute path to a human-readable relative path from cwd
 */
export function humanizePath(filepath: string): string {
  const { relative } = require('path');
  return normalizePath(relative(process.cwd(), filepath));
}
