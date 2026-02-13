import { extname } from 'path';

/**
 * Dynamically imports a module using CJS require().
 * Provides a single point of change for future ESM migration.
 *
 * Falls back to real import() for ESM-only packages that
 * throw ERR_REQUIRE_ESM.
 */
export async function handleImport<T = any>(modulePath: string): Promise<T> {
  const normalizedPath =
    extname(modulePath) === '.js' ? modulePath.slice(0, -3) : modulePath;
  try {
    return require(normalizedPath) as T;
  } catch (e: any) {
    if (e.code === 'ERR_REQUIRE_ESM') {
      return import(modulePath) as Promise<T>;
    }
    throw e;
  }
}
