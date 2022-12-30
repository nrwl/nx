import { accessSync } from 'fs';

/**
 * Checks if package is available
 * @param name name of the package
 * @returns
 */
export function packageExists(name: string): boolean {
  try {
    // TODO(meeroslav): This will not work once we start using yarn Berry with PnP
    accessSync(`./node_modules/.bin/${name}`);
    return true;
  } catch (e) {
    return false;
  }
}
