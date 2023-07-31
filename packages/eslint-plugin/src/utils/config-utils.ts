import { detectPackageManager } from '@nx/devkit';
import { execSync } from 'child_process';
import { accessSync } from 'fs';

/**
 * Checks if package is available
 * @param name name of the package
 * @returns
 */
export function packageExists(name: string): boolean {
  const pm = detectPackageManager();
  if (pm === 'yarn') {
    try {
      execSync(`yarn info ${name}`);
      return true;
    } catch (e) {
      return false;
    }
  }
  try {
    accessSync(`./node_modules/.bin/${name}`);
    return true;
  } catch (e) {
    return false;
  }
}
