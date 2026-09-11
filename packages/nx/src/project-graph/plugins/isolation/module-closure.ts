import * as nodeModule from 'node:module';
import { sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const VENDOR_SEGMENT = `${sep}node_modules${sep}`;

type LoadHooks = {
  load(url: string, context: unknown, next: Function): unknown;
};
type RegisterHooks = (hooks: LoadHooks) => { deregister(): void };

/**
 * The files a plugin's load actually read, or null when this runtime cannot be
 * asked completely.
 *
 * What a plugin registers is decided by the code that runs while it loads, so
 * this is the exact set of files the answer depends on. A caller holding them
 * can tell whether a previous answer still holds, without guessing at where a
 * plugin keeps its sources or at which of them it reaches.
 */
export async function withModuleClosure<T>(
  load: () => Promise<T>
): Promise<{ result: T; sourceFiles: string[] | null }> {
  const observed = new Set<string>();
  const registerHooks = (
    nodeModule as unknown as { registerHooks?: RegisterHooks }
  ).registerHooks;

  // Synchronous in-thread hooks, which see CJS and ESM alike. `module.register`
  // is the older door, but it runs hooks on another thread and reports over a
  // port with no guarantee every message has landed by the time the import
  // resolves, so it cannot answer this without a race.
  if (typeof registerHooks === 'function') {
    const hooks = registerHooks({
      load(url, context, next) {
        record(observed, url);
        return next(url, context);
      },
    });
    try {
      return { result: await load(), sourceFiles: [...observed] };
    } finally {
      // Left registered it would keep collecting through every later hook call,
      // billing those files to the load.
      hooks.deregister();
    }
  }

  // Older runtimes: the require cache covers CJS, and TypeScript that went
  // through a require hook, but not a module reached by dynamic import. An
  // empty result tells the caller the set is unusable rather than small.
  const before = new Set(Object.keys(require.cache));
  const result = await load();
  for (const file of Object.keys(require.cache)) {
    if (!before.has(file)) {
      record(observed, file);
    }
  }
  return { result, sourceFiles: observed.size ? [...observed] : null };
}

/**
 * Vendored code is left out. An installed package's version already identifies
 * it, and hashing its whole dependency closure on every command would cost more
 * than loading the plugin.
 */
function record(into: Set<string>, specifier: string): void {
  let path = specifier;
  if (path.startsWith('file://')) {
    path = fileURLToPath(path);
  } else if (path.includes('://')) {
    return;
  }
  if (!path.includes(VENDOR_SEGMENT)) {
    into.add(path);
  }
}
