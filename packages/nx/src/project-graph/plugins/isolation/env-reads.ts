import { hashArray } from '../../../native';

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

/** Keys that say how a process was started rather than what it should do. */
const INVOCATION_KEYS = new Set(['_', 'PWD', 'OLDPWD', 'SHLVL']);

/**
 * Keys Nx writes into its own environment while running a command.
 *
 * These are Nx's state, not the workspace's input. Nx decides each one per
 * command from the arguments and the terminal, so `nx build app` and
 * `nx run-many -t build` disagree about `NX_TUI` on a TTY. A plugin reads them
 * without asking: `@nx/eslint`'s and `@nx/jest`'s loads both reach
 * `is-tui-enabled.ts`, which takes `NX_TUI` at module scope. Recording one
 * would invalidate every record on the next command of a different shape.
 *
 * Kept in step with the code by `env-reads-self-set.spec.ts`, which fails when
 * Nx starts writing a key nobody has classified.
 */
const SELF_SET_KEYS = new Set([
  'NX_ANALYTICS_SESSION_ID',
  'NX_CLI_SET',
  'NX_DAEMON_PROCESS',
  'NX_DRY_RUN',
  'NX_GENERATE_QUIET',
  'NX_INTERACTIVE',
  'NX_LOAD_DOT_ENV_FILES',
  'NX_PREFIX_OUTPUT',
  'NX_RELEASE_INTERNAL_SUPPRESS_FILTER_LOG',
  'NX_RUNNING_NX_IMPORT',
  'NX_RUNNING_NX_INIT',
  'NX_STREAM_OUTPUT',
  'NX_TUI',
  'NX_TUI_AUTO_EXIT',
  'NX_VERBOSE_LOGGING',
]);

/** Exported for the spec that keeps the set in step with Nx's own writes. */
export function isSelfSet(key: string): boolean {
  return SELF_SET_KEYS.has(key);
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
  // Left out rather than recorded, for the same reason in both cases: the value
  // differs between two invocations that should share a record, and nothing a
  // plugin registers is decided from it.
  if (INVOCATION_KEYS.has(key) || SELF_SET_KEYS.has(key)) {
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
