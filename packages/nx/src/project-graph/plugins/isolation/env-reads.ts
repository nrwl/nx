/** What a load read from the environment, by key, with null for a key that was not set. */
export type EnvReads = Record<string, string | null>;

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
  // Absence is part of the answer: `NX_DOTNET_DISABLE` is unset in the run that
  // records a working plugin, and setting it later has to invalidate that.
  read[key] ??= key in env ? env[key] : null;
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
