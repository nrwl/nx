import { extname, resolve } from 'path';

/**
 * Dynamically imports a module using CJS require().
 * Provides a single point of change for future ESM migration.
 *
 * Falls back to real import() for ESM-only packages that
 * throw ERR_REQUIRE_ESM.
 *
 * @param modulePath - The module specifier (relative, absolute, or package name)
 * @param relativeTo - The directory to resolve relative paths against.
 *   Pass `__dirname` from the call site when using relative paths like './foo.js'.
 */
export async function handleImport<T = any>(
  modulePath: string,
  relativeTo?: string
): Promise<T> {
  let resolvedPath = modulePath;
  if (
    relativeTo &&
    (modulePath.startsWith('./') || modulePath.startsWith('../'))
  ) {
    resolvedPath = resolve(relativeTo, modulePath);
  }
  const normalizedPath =
    extname(resolvedPath) === '.js' ? resolvedPath.slice(0, -3) : resolvedPath;
  try {
    return require(normalizedPath) as T;
  } catch (e: any) {
    if (e.code === 'ERR_REQUIRE_ESM') {
      return import(resolvedPath) as Promise<T>;
    }
    throw e;
  }
}
