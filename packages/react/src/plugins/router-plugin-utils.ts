import { readJsonFile } from '@nx/devkit';
import { dirname, join } from 'path';
import { pathToFileURL } from 'url';

const dynamicImport = new Function('specifier', 'return import(specifier)') as (
  specifier: string
) => Promise<any>;

/**
 * Whether `request` resolves from `directory`, without loading it.
 */
export function canResolve(request: string, directory: string): boolean {
  try {
    require.resolve(request, { paths: [directory] });
    return true;
  } catch {
    return false;
  }
}

/**
 * Imports the Vite that the project resolves from its root. Throws when the
 * project can't resolve Vite.
 */
export async function loadProjectVite(absoluteProjectRoot: string) {
  const packageJsonPath = require.resolve('vite/package.json', {
    paths: [absoluteProjectRoot],
  });
  // Vite 5 and 6 map `require` to a CJS build, so read the ESM entry instead
  const entry = readJsonFile(packageJsonPath).exports['.'];
  const entryPath = join(
    dirname(packageJsonPath),
    entry.import?.default ?? entry.import ?? entry
  );
  return dynamicImport(pathToFileURL(entryPath).href);
}
