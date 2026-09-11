import * as nodeModule from 'node:module';
import { isAbsolute, sep } from 'node:path';
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
  load: () => Promise<T>,
  // Null says "this runtime has none", which a test can say and an absent
  // default cannot: a default parameter treats an explicit undefined as absent.
  registerHooks: RegisterHooks | null | undefined = (
    nodeModule as unknown as { registerHooks?: RegisterHooks }
  ).registerHooks
): Promise<{ result: T; sourceFiles: string[] | null }> {
  // Below Node 22.15 there is no way to observe this, and a partial answer is
  // worse than none. The require cache was the obvious fallback and is not one:
  // it sees a CJS graph but not an ESM edge reached from inside it, so a plugin
  // whose entry re-exports its hooks from a sibling module reports only the
  // entry, and nothing distinguishes that from a complete capture. A record
  // built on it would never notice the sibling changing, which is the failure
  // this whole mechanism exists to prevent.
  if (typeof registerHooks !== 'function') {
    return { result: await load(), sourceFiles: null };
  }

  // Synchronous in-thread hooks, which see CJS and ESM alike. `module.register`
  // is the other door, but it runs hooks on another thread and reports over a
  // port with no guarantee every message has landed by the time the import
  // resolves, so it cannot answer this without a race.
  const observed = new Set<string>();
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

/**
 * Only files whose contents could differ between two runs of the same Nx.
 *
 * A builtin has no contents to hash, and vendored code is identified by its
 * package's version: hashing a package's whole dependency closure on every
 * command would cost more than loading the plugin.
 */
function record(into: Set<string>, specifier: string): void {
  if (specifier.startsWith('node:')) {
    return;
  }

  let path = specifier;
  if (path.startsWith('file://')) {
    path = fileURLToPath(path);
  } else if (path.includes('://')) {
    return;
  }

  // A bare specifier that reached here is a builtin under its old spelling, such
  // as `fs`. Anything else resolves to a path.
  if (!isAbsolute(path) || path.includes(VENDOR_SEGMENT)) {
    return;
  }
  into.add(path);
}
