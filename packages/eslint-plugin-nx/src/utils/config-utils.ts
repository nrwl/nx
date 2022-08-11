import { execSync } from 'child_process';

/**
 * Checks if package is available
 * @param name name of the package
 * @returns
 */
export function packageExists(name: string): boolean {
  try {
    execSync(`npm ls ${name}`, { stdio: 'ignore' });
    return true;
  } catch (e) {
    return false;
  }
}
