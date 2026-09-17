import { hashArray } from '../../../native';
import { isExcludedEnvVar } from '../../../daemon/client/daemon-environment';

/**
 * What a load read from the environment: which variables, and one hash over all
 * of their values together.
 *
 * Neither the values nor a hash of any single value. A load reads whatever its
 * dependencies read, and measured on this repository, loading `@nx/js`'s
 * TypeScript plugin reads 44 variables, among them `NX_CLOUD_ACCESS_TOKEN`. A
 * record goes to a database under `~/.nx`, which `ensureOwnedPrivateDir` keeps
 * at 0700, but that database is also what people attach to a support request.
 * One hash over the whole set cannot be worked backwards a value at a time,
 * where a hash per variable could be, for a short one. The names are kept, since
 * a read has to know what to look at again and a name is not the secret.
 */
export type EnvReads = { keys: string[]; hash: string };

/**
 * Whether a variable is one a record must not rest on.
 *
 * The daemon's own list, rather than a second one. A plugin worker inherits the
 * environment of whichever process spawned it, and the daemon's is `process.env`
 * minus these, so a record written by a daemon worker and read by a CLI client
 * would disagree about every one of them and could never hold. Nx already states
 * that these cannot affect the project graph, and what a plugin registers is
 * graph input, so the claim is the same one.
 *
 * The trade is that a plugin branching on one of them records an answer that
 * nothing here invalidates. `repairRecord` corrects it the next time a worker
 * loads, which is the same backstop the other blind spots rest on.
 */
function isRecordableEnvKey(key: string): boolean {
  return !isExcludedEnvVar(key);
}

/**
 * Stands in for a variable nobody set. Not a value any environment can hold, so
 * unset stays distinct from a variable whose value is the string "undefined".
 */
const UNSET = '\u0000<unset>';

/** Exported so a read hashes what it compares the way the record was written. */
export function hashEnvReads(
  keys: string[],
  env: NodeJS.ProcessEnv = process.env
): string {
  return hashArray(keys.flatMap((key) => [key, key in env ? env[key] : UNSET]));
}

/**
 * The environment a plugin's load read, or null when what it read cannot be
 * bounded.
 *
 * Only what the plugin's own load reads. Nx's modules read the environment at
 * import time too, for its terminal, its cloud client and its CI detection, and
 * a plugin importing one of those would otherwise be recorded against every
 * variable Nx cares about. `observePluginLoad` settles that before this
 * starts.
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
  const read = new Set<string>();
  let bounded = true;

  const observed = new Proxy(env, {
    get(target, key) {
      if (typeof key === 'string') {
        record(read, key);
      }
      return target[key as string];
    },
    has(target, key) {
      if (typeof key === 'string') {
        record(read, key);
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
    const keys = [...read];
    return {
      result,
      envReads: bounded ? { keys, hash: hashEnvReads(keys, env) } : null,
    };
  } finally {
    install(env);
  }
}

function record(read: Set<string>, key: string): void {
  if (!isRecordableEnvKey(key)) {
    return;
  }
  read.add(key);
}

function install(env: NodeJS.ProcessEnv): void {
  // Set on the property rather than assigned. Assignment installs a proxy too,
  // and this makes putting the real environment back the same operation as
  // putting the proxy in.
  Object.defineProperty(process, 'env', {
    value: env,
    configurable: true,
    writable: true,
    enumerable: true,
  });
}
