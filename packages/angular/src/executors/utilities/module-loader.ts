import { extname } from 'path';
import { pathToFileURL } from 'node:url';

export async function loadModule<T = any>(path: string): Promise<T> {
  switch (extname(path)) {
    case '.mjs': {
      const result = await loadEsmModule(pathToFileURL(path));
      return (result as { default: T }).default ?? (result as T);
    }
    case '.cjs': {
      const result = require(path);
      return result.default ?? result;
    }

    default:
      // it can be CommonJS or ESM, try both
      try {
        const result = require(path);
        return result.default ?? result;
      } catch (e: any) {
        if (e.code === 'ERR_REQUIRE_ESM') {
          const result = await loadEsmModule(pathToFileURL(path));
          return (result as { default: T }).default ?? (result as T);
        }

        throw e;
      }
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
