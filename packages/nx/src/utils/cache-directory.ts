import { createHash, randomBytes } from 'crypto';
import { existsSync, unlinkSync, writeFileSync } from 'fs';
import { isAbsolute, join } from 'path';
import type { NxJsonConfiguration } from '../config/nx-json';
import { readNxJson } from '../config/nx-json';
import { getMainWorktreeRoot } from '../native';
import { NX_HOME_TMP_DIR, NX_TMP_DIR, NX_USER_TMP_DIR } from './nx-tmp-dir';
import {
  canonicalDir,
  type DirRefusal,
  ensureOwnedPrivateDir,
} from './owned-private-dir';
import { workspaceRoot } from './workspace-root';

function absolutePath(root: string, path: string): string {
  if (isAbsolute(path)) {
    return path;
  } else {
    return join(root, path);
  }
}

function cacheDirectory(root: string, cacheDirectory: string) {
  const cacheDirFromEnv = process.env.NX_CACHE_DIRECTORY;
  if (cacheDirFromEnv) {
    cacheDirectory = cacheDirFromEnv;
  }
  if (cacheDirectory) {
    return absolutePath(root, cacheDirectory);
  } else {
    return defaultCacheDirectory(root);
  }
}

function pickCacheDirectory(
  root: string,
  nonNxCacheDirectory: string,
  nxCacheDirectory: string
) {
  // If nx.json doesn't exist the repo can't utilize
  // caching, so .nx/cache is less relevant. Lerna users
  // that don't want to fully opt in to Nx at this time
  // may also be caught off guard by the appearance of
  // a .nx directory, so we are going to special case
  // this for the time being.
  if (
    existsSync(join(root, 'lerna.json')) &&
    !existsSync(join(root, 'nx.json'))
  ) {
    return join(root, 'node_modules', '.cache', nonNxCacheDirectory);
  }
  return join(root, '.nx', nxCacheDirectory);
}

function defaultCacheDirectory(root: string) {
  return pickCacheDirectory(root, 'nx', 'cache');
}

function defaultWorkspaceDataDirectory(root: string) {
  return pickCacheDirectory(root, 'nx-workspace-data', 'workspace-data');
}

/**
 * `readNxJson` rather than a raw read, so a `cacheDirectory` reached through
 * `extends` counts. It throws on malformed JSON, which must not take the
 * process down here: this runs at module scope, and a broken `nx.json` has a
 * better error waiting for it further in.
 */
export function readCacheDirectoryProperty(root: string): string | undefined {
  try {
    const nxJson: NxJsonConfiguration = readNxJson(root);
    return (
      nxJson.cacheDirectory ??
      nxJson.tasksRunnerOptions?.default.options.cacheDirectory
    );
  } catch {
    return undefined;
  }
}

/** The data a repository's checkouts share, each in its own directory. */
export type SharedDataKind = 'cache' | 'workspace-data';

const SHARED_DATA_KINDS: readonly SharedDataKind[] = [
  'cache',
  'workspace-data',
];

/**
 * Whether `~/.nx` is somewhere other than the shared container.
 *
 * `homedir()` honours `$HOME`, so with `HOME=/tmp` the two are one path -- and
 * that container is deliberately world-writable (`1777`) so peers can each
 * create their own subtree under it. Build outputs and the graph DB get
 * replayed into the workspace and supply target commands, so they cannot live
 * anywhere a peer can replace them.
 *
 * `daemon/tmp-dir.ts` makes the same check for the socket tier. It cannot be
 * shared from there: that module imports this one.
 */
function homeDirIsDistinctFromSharedTmp(): boolean {
  if (!NX_HOME_TMP_DIR) {
    return false;
  }
  const home = canonicalDir(NX_HOME_TMP_DIR);
  return ![NX_TMP_DIR, NX_USER_TMP_DIR].some(
    (shared) => canonicalDir(shared) === home
  );
}

/** Memoizes the verdict below, per repository. */
const sharedRootUsable = new Map<string, SharedDataLocation>();

/** The establish verdict is cached per process; tests need it cleared. */
export function resetSharedRootCacheForTesting() {
  sharedRootUsable.clear();
}

/**
 * Establishes every directory the shared layout needs, owner-only.
 *
 * All of them together, because both kinds have to reach the same verdict: a
 * run whose cache relocated while its DB did not takes a cache hit on artifacts
 * it never wrote. One answer serves both.
 */
function establishUserRoot(mainRoot: string): DirRefusal | undefined {
  if (!NX_HOME_TMP_DIR || !homeDirIsDistinctFromSharedTmp()) {
    return { kind: 'not-a-directory', dir: NX_HOME_TMP_DIR ?? '~/.nx' };
  }

  const repoRoot = join(NX_HOME_TMP_DIR, sharedDirName(mainRoot));
  const required = [
    NX_HOME_TMP_DIR,
    repoRoot,
    ...SHARED_DATA_KINDS.map((kind) => join(repoRoot, kind)),
  ];

  for (const dir of required) {
    // Non-recursive and 0700 per level, with ownership re-checked -- a level
    // left at the ambient umask is what the next run refuses.
    const result = ensureOwnedPrivateDir(dir);
    if (result.status === 'refused') {
      return result.refusal;
    }
  }
  return probeWritable(join(repoRoot, 'cache'));
}

/**
 * Whether this process can actually write under the shared root.
 *
 * `ensureOwnedPrivateDir` tolerates `EEXIST` and performs no write at all for a
 * 0700 directory we already own, so on every run after the first it establishes
 * nothing. A sandbox that denies writes under `~/.nx` reaches this point with
 * four no-ops behind it and would be told to put its cache there -- then EPERM
 * on every write, which is the failure the fallback exists to avoid. Writing is
 * what the caller is about to do, so writing is what gets tested.
 *
 * The marker name is random and the create is exclusive. `wx` is what stops a
 * symlink planted at this path being followed: the default `w` would truncate
 * whatever it points at, outside the granted root, and still report writable.
 * `~/.nx` is writable by a sandboxed agent sharing our uid, so no ownership
 * check fires on it. Randomness also keeps the anti-collision property the pid
 * gave, without making the name guessable. The marker is removed either way.
 */
function probeWritable(dir: string): DirRefusal | undefined {
  const marker = join(dir, `.nx-write-probe-${randomBytes(8).toString('hex')}`);
  try {
    writeFileSync(marker, '', { flag: 'wx' });
    return undefined;
  } catch (e: any) {
    return { kind: 'not-created', dir, code: e?.code };
  } finally {
    try {
      unlinkSync(marker);
    } catch {}
  }
}

/**
 * Whether a refusal means this process cannot write outside its own checkout.
 *
 * `mkdir` is what an agent sandbox denies, and `ensureOwnedPrivateDir` reports
 * that as `not-created` carrying the errno. Every other refusal is about `~/.nx`
 * itself -- owned by root after a `sudo nx` that kept `HOME`, or left at a mode
 * Nx will not re-lock -- and says nothing about where the data should go.
 *
 * Testing the actual `mkdir` rather than the agent's name is what makes this
 * cover sandboxes Nx has never heard of. An `access(W_OK)` probe would not:
 * Linux Landlock does not enforce it, so it reports writable in exactly the
 * case this exists for.
 */
function refusalMeansConfined(refusal: DirRefusal): boolean {
  return (
    refusal.kind === 'not-created' &&
    (refusal.code === 'EPERM' ||
      refusal.code === 'EACCES' ||
      refusal.code === 'EROFS')
  );
}

/** Where this repository can actually share, cached per repository. */
function shareableLocation(mainRoot: string): SharedDataLocation {
  const cached = sharedRootUsable.get(mainRoot);
  if (cached !== undefined) {
    return cached;
  }

  const refusal = establishUserRoot(mainRoot);
  const location: SharedDataLocation = !refusal
    ? { share: 'user', mainRoot }
    : refusalMeansConfined(refusal)
      ? { share: 'none' }
      : { share: 'main', mainRoot };

  sharedRootUsable.set(mainRoot, location);
  return location;
}

/**
 * Keyed on the main checkout, so every worktree of one repository shares a
 * directory while two clones of the same project do not collide.
 *
 * This is the outer segment, with the kind beneath it, so one repository's
 * shared data is a single directory: `~/.nx/<hash>/{cache,workspace-data}`.
 */
function sharedDirName(mainWorktreeRoot: string): string {
  const canonical = canonicalDir(mainWorktreeRoot);
  // Case-folded only where the filesystem is, so the many spellings that reach
  // one directory on Windows and macOS key one hash. Linux is case-sensitive:
  // `/repo/App` and `/repo/app` are two directories there, and folding them
  // would hand both the same cache.
  const key =
    process.platform === 'win32' || process.platform === 'darwin'
      ? canonical.toLowerCase()
      : canonical;
  return createHash('sha256').update(key).digest('hex').substring(0, 16);
}

/**
 * Where this checkout's shared data lives.
 *
 * `none` keeps its own copy, `main` uses the main checkout's own directories,
 * `user` uses the per-user shared root.
 */
export type SharedDataLocation =
  | { share: 'none' }
  | { share: 'main'; mainRoot: string }
  | { share: 'user'; mainRoot: string };

/**
 * The one decision the cache and the workspace-data DB both follow.
 *
 * They have to move together. The DB's `cache_outputs` rows index the cache
 * directory's contents, so a checkout reading a shared DB while writing a
 * private cache takes a hit on a row whose artifacts it does not have -- and
 * `finalizeCacheHits` still calls that `local-cache`, with nothing restored.
 * Two predicates is how that happens, so there is only one.
 *
 * The per-user root is preferred for every checkout, not only for linked
 * worktrees. A main checkout that kept its own `.nx` would stop sharing with
 * its worktrees the moment one was added, which is the inconsistency this
 * avoids -- and an agent sandbox can be granted `~/.nx` by a committed
 * settings file, where an absolute checkout path cannot (NXC-4625).
 */
export function resolveSharedDataLocation(root: string): SharedDataLocation {
  // Process-global, and pointing at one location for this run whichever
  // checkout asks. There is nothing left to share, so this is settled before
  // anything touches git or the filesystem.
  if (
    process.env.NX_CACHE_DIRECTORY ||
    process.env.NX_WORKSPACE_DATA_DIRECTORY ||
    process.env.NX_PROJECT_GRAPH_CACHE_DIRECTORY
  ) {
    return { share: 'none' };
  }

  let mainRoot: string;
  try {
    // `null` means this checkout is the main one, or is not a git repository
    // at all. Either way it keys the shared directory itself.
    mainRoot = getMainWorktreeRoot(root) ?? root;
  } catch {
    // Worktree detection is best-effort.
    mainRoot = root;
  }

  const configured = readCacheDirectoryProperty(root);
  if (configured) {
    // A configured location is the user's and is not ours to relocate. Two
    // worktrees configuring the same value are still naming one location
    // though, so they can still share it -- through the main checkout, the
    // only root both of them agree on. Different values are different
    // intents; keep those apart.
    return readCacheDirectoryProperty(mainRoot) === configured
      ? { share: 'main', mainRoot }
      : { share: 'none' };
  }

  return shareableLocation(mainRoot);
}

/**
 * The per-user directory a repository's checkouts share for `kind`.
 *
 * It lives outside every checkout because an agent sandbox grants paths, and a
 * checkout's absolute path is different on each machine so it cannot be
 * committed to a shared settings file. This root can (NXC-4625).
 */
export function sharedUserDataDir(
  mainRoot: string,
  kind: SharedDataKind
): string {
  return join(NX_HOME_TMP_DIR, sharedDirName(mainRoot), kind);
}

/**
 * The directory `kind` resolves to, following the one sharing decision.
 *
 * The shared answer is the same shape for both kinds. The unshared one is not:
 * the cache honours a configured `cacheDirectory` and the lerna special case,
 * the DB honours `NX_WORKSPACE_DATA_DIRECTORY`. Which root it applies to is the
 * only part the sharing decision has a say in.
 */
export function sharedDataDirectory(
  root: string,
  kind: SharedDataKind
): string {
  const location = resolveSharedDataLocation(root);
  if (location.share === 'user') {
    return sharedUserDataDir(location.mainRoot, kind);
  }
  const target = location.share === 'main' ? location.mainRoot : root;
  return kind === 'cache'
    ? cacheDirectoryForWorkspace(target)
    : workspaceDataDirectoryForWorkspace(target);
}

/**
 * Path to the directory where Nx stores its cache.
 *
 * Normally the shared per-user directory, so a checkout and every worktree
 * added to it use one cache. A configured `cacheDirectory` is honored instead, and is
 * still shared through the main checkout when both checkouts configure the
 * same value. See `resolveSharedDataLocation`.
 */
export const cacheDir = sharedDataDirectory(workspaceRoot, 'cache');

export function cacheDirectoryForWorkspace(root: string) {
  return cacheDirectory(root, readCacheDirectoryProperty(root));
}

/**
 * This checkout's own workspace-data directory, never the shared one. Daemon
 * logs and the `disabled` marker live here, and both describe this checkout.
 */
export const workspaceDataDirectory =
  workspaceDataDirectoryForWorkspace(workspaceRoot);

export function workspaceDataDirectoryForWorkspace(workspaceRoot: string) {
  return absolutePath(
    workspaceRoot,
    process.env.NX_WORKSPACE_DATA_DIRECTORY ??
      process.env.NX_PROJECT_GRAPH_CACHE_DIRECTORY ??
      defaultWorkspaceDataDirectory(workspaceRoot)
  );
}
