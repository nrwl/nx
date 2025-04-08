import * as path from 'path';
import { workspaceRoot } from './workspace-root';

function removeWindowsDriveLetter(osSpecificPath: string): string {
  return osSpecificPath.replace(/^[a-zA-Z]:/, '');
}

/**
 * Coverts an os specific path to a unix style path. Use this when writing paths to config files.
 * This should not be used to read files on disk because of the removal of Windows drive letters.
 */
export function normalizePath(osSpecificPath: string): string {
  return removeWindowsDriveLetter(osSpecificPath).split('\\').join('/');
}

/**
 * Normalized path fragments and joins them. Use this when writing paths to config files.
 * This should not be used to read files on disk because of the removal of Windows drive letters.
 */
export function joinPathFragments(...fragments: string[]): string {
  return normalizePath(path.join(...fragments));
}

/**
 * When running a script with the package manager (e.g. `npm run`), the package manager will
 * traverse the directory tree upwards until it finds a `package.json` and will set `process.cwd()`
 * to the folder where it found it. The actual working directory is stored in the INIT_CWD
 * environment variable (see here: https://docs.npmjs.com/cli/v9/commands/npm-run-script#description).
 *
 * @returns The path to the current working directory.
 */
export function getCwd(): string {
  return process.env.INIT_CWD?.startsWith(workspaceRoot)
    ? process.env.INIT_CWD
    : process.cwd();
}
