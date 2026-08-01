import { extname } from 'path';
import { pathToFileURL } from 'node:url';
import { loadTsFile, requireWithTsconfigFallback } from '@nx/js/internal';

export async function loadModule<T = any>(
  path: string,
  tsConfig?: string
): Promise<T> {
  const ext = extname(path);

  if (ext === '.mjs') {
    const result = await loadEsmModule(pathToFileURL(path));
    return (result as { default: T }).default ?? (result as T);
  }

  if (ext === '.cjs') {
    const result = requireWithTsconfigFallback<T>(path, tsConfig);
    return (result as { default?: T }).default ?? result;
  }

  const isTs = ext === '.ts' || ext === '.cts' || ext === '.mts';

  try {
    const result =
      isTs && tsConfig
        ? loadTsFile<any>(path, tsConfig)
        : requireWithTsconfigFallback<any>(path, tsConfig);
    return result.default ?? result;
  } catch (e: any) {
    // ERR_REQUIRE_ESM (legacy) and ERR_REQUIRE_ASYNC_MODULE (Node 22.12+,
    // ESM with top-level await) both indicate the module must be loaded via
    // dynamic import.
    if (e.code === 'ERR_REQUIRE_ESM' || e.code === 'ERR_REQUIRE_ASYNC_MODULE') {
      const result = await loadEsmModule(pathToFileURL(path));
      return (result as { default: T }).default ?? (result as T);
    }
    throw e;
  }
}

/**
 * Lazily compiled dynamic import loader function.
 */
let load: (<T>(modulePath: string | URL) => Promise<T>) | undefined;

/**
 * This uses a dynamic import to load a module which may be ESM.
 * CommonJS code can load ESM code via a dynamic import. Unfortunately, TypeScript
 * will currently, unconditionally downlevel dynamic import into a require call.
 * require calls cannot load ESM code and will result in a runtime error. To workaround
 * this, a Function constructor is used to prevent TypeScript from changing the dynamic import.
 * Once TypeScript provides support for keeping the dynamic import this workaround can
 * be dropped.
 *
 * @param modulePath The path of the module to load.
 * @returns A Promise that resolves to the dynamically imported module.
 */
export function loadEsmModule<T = any>(modulePath: string | URL): Promise<T> {
  load ??= new Function('modulePath', `return import(modulePath);`) as Exclude<
    typeof load,
    undefined
  >;

  return load(modulePath);
}
