import { hashArray } from '../../../native';

/**
 * What a load read from the environment: a hash of each value it saw, with null
 * for a key that was not set.
 *
 * Hashed rather than kept, because a read is only ever compared for equality and
 * because a load reads whatever its dependencies read. Measured on this
 * repository, loading `@nx/js`'s TypeScript plugin reads 44 variables, among
 * them `NX_CLOUD_ACCESS_TOKEN`, and a record goes to a database on disk.
 */
export type EnvReads = Record<string, string | null>;

/** Keys that say how a process was started rather than what it should do. */
const INVOCATION_KEYS = new Set(['_', 'PWD', 'OLDPWD', 'SHLVL']);

/** Exported so a read hashes what it compares the way the record was written. */
export function hashEnvValue(value: string | undefined): string {
  return hashArray([value ?? '']);
}

/**
 * The environment a plugin's load read, or null when what it read cannot be
 * bounded.
 *
 * What a plugin registers is decided while it loads, and the environment is the
 * other input to that besides its own source. `@nx/dotnet` exports no hooks at
 * all when `NX_DOTNET_DISABLE` is set, and its files are identical either way,
 * so a record keyed on identity and checked against file contents cannot tell
 * the two apart. Reading the keys back gives the check the same exactness over
 * the environment that the module closure gives it over the source.
 */
export async function withEnvReads<T>(
  load: () => Promise<T>,
  env: NodeJS.ProcessEnv = process.env
): Promise<{ result: T; envReads: EnvReads | null }> {
  const read: EnvReads = {};
  let bounded = true;

  const observed = new Proxy(env, {
    get(target, key) {
      if (typeof key === 'string') {
        record(read, target, key);
      }
      return target[key as string];
    },
    has(target, key) {
      if (typeof key === 'string') {
        record(read, target, key);
      }
      return key in target;
    },
    ownKeys(target) {
      // Spread, `Object.keys`, `JSON.stringify`: the load has taken the whole
      // environment, so nothing short of the whole environment describes what it
      // depends on. Reported as unbounded rather than recorded, since a record
      // naming every variable would be invalidated by any of them.
      bounded = false;
      return Reflect.ownKeys(target);
    },
  });

  install(observed);
  try {
    const result = await load();
    return { result, envReads: bounded ? read : null };
  } finally {
    install(env);
  }
}

function record(read: EnvReads, env: NodeJS.ProcessEnv, key: string): void {
  // Left out rather than recorded: these say which binary ran and from where,
  // they differ between two invocations that should share a record, and nothing
  // decides what it registers from them. Recording one would invalidate every
  // record on the next command run a different way.
  if (INVOCATION_KEYS.has(key) || key in read) {
    return;
  }

  // Absence is part of the answer: `NX_DOTNET_DISABLE` is unset in the run that
  // records a working plugin, and setting it later has to invalidate that. Null
  // says unset and no hash can produce it, so a variable whose value is the
  // string "undefined" stays distinct from one nobody set.
  read[key] = key in env ? hashEnvValue(env[key]) : null;
}

function install(env: NodeJS.ProcessEnv): void {
  // Assigning `process.env` copies properties into the real environment rather
  // than replacing the object, so the proxy has to go on the property itself.
  Object.defineProperty(process, 'env', {
    value: env,
    configurable: true,
    writable: true,
    enumerable: true,
  });
}
