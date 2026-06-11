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
export declare function handleImport<T = any>(modulePath: string, relativeTo?: string): Promise<T>;
