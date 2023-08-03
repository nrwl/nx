/**
 * Checks if package is available
 * @param name name of the package
 * @returns
 */
export function packageExists(name: string): boolean {
  try {
    require.resolve(name);
    return true;
  } catch {
    return false;
  }
}
