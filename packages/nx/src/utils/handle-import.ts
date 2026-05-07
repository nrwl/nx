import { extname, resolve } from 'path';

/**
 * Dynamically imports a module using CJS require().
 * Provides a single point of change for future ESM migration.
 *
 * Falls back to real import() for ESM-only packages that
 * throw ERR_REQUIRE_ESM. When loading a workspace plugin's `.ts` entry
 * under native TypeScript stripping, also falls back to swc/ts-node if
 * the file uses constructs Node can't strip (enum, runtime namespace,
 * legacy decorators, etc.).
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
    if (e?.code === 'ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX') {
      // Lazy-require to avoid pulling register/transpiler (and their
      // daemon/logger transitive deps) into module-eval-time graphs.
      const {
        forceRegisterPluginTSTranspiler,
      } = require('../project-graph/plugins/transpiler') as typeof import('../project-graph/plugins/transpiler');
      forceRegisterPluginTSTranspiler();
      try {
        delete require.cache[require.resolve(normalizedPath)];
      } catch {
        // require.resolve may throw if the failed load never reached cache
      }
      return require(normalizedPath) as T;
    }
    throw e;
  }
}
