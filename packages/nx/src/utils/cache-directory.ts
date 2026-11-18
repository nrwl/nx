import { createHash, randomBytes } from 'crypto';
import {
  existsSync,
  lstatSync,
  mkdirSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'fs';
import { dirname, isAbsolute, join, relative, resolve } from 'path';
import type { NxJsonConfiguration } from '../config/nx-json';
import { readNxJson } from '../config/nx-json';
import { homeDirIsDistinctFromSharedTmp, NX_HOME_TMP_DIR } from './nx-tmp-dir';
import {
  canonicalDir,
  type DirRefusal,
  ensureOwnedPrivateDir,
} from './owned-private-dir';
import { generateWorkspaceId } from './workspace-id';
import { workspaceRoot } from './workspace-root';

const S_ISVTX = 0o1000;

const trustedConfiguredDirs = new Set<string>();

export class UntrustedDataDirectoryError extends Error {
  constructor(kind: string, dir: string, reason: string) {
    super(
      `The configured Nx ${kind} directory ${dir} is not safe to use: ${reason}. ` +
        `Nx restores task outputs and reads cached configuration from this directory, so it must only be modifiable by you, root, or the owner of the workspace. ` +
        `Point it at a directory you own instead, or set NX_ALLOW_INSECURE_DIRECTORIES=true to use it anyway.`
    );
    this.name = 'UntrustedDataDirectoryError';
  }
}

/**
 * Creates a configured data directory and refuses it if a user other than us,
 * root, or the workspace owner could replace its contents. Paths inside the
 * workspace are trusted like the workspace. Group write is an explicit grant.
 */
function ensureTrustedConfiguredDir(
  dir: string,
  root: string,
  kind: string
): string {
  const key = `${dir}\0${root}`;
  if (typeof process.getuid !== 'function' || trustedConfiguredDirs.has(key)) {
    return dir;
  }

  // Claim a missing directory under a shared parent before another user can.
  if (!isWithin(resolve(dir), resolve(root)) && nearestExistingIsShared(dir)) {
    try {
      mkdirSync(dir, { recursive: true, mode: 0o775 });
    } catch {}
  }

  const trusted = new Set([process.getuid(), 0]);
  try {
    trusted.add(statSync(root).uid);
  } catch {}

  // The path as written catches a symlink a peer could repoint; the canonical
  // path catches the directories the symlinks lead to.
  for (const [leaf, stop] of [
    [resolve(dir), resolve(root)],
    [canonicalDir(dir), canonicalDir(root)],
  ]) {
    if (isWithin(leaf, stop)) {
      continue;
    }
    for (let p = leaf; p !== stop; p = dirname(p)) {
      const reason = untrustedReason(p, p === leaf, trusted);
      if (reason) {
        if (process.env.NX_ALLOW_INSECURE_DIRECTORIES !== 'true') {
          throw new UntrustedDataDirectoryError(kind, dir, reason);
        }
        console.warn(
          `NX_ALLOW_INSECURE_DIRECTORIES is set, so Nx is using the ${kind} directory ${dir} although ${reason}.`
        );
        trustedConfiguredDirs.add(key);
        return dir;
      }
      if (dirname(p) === p) {
        break;
      }
    }
  }

  trustedConfiguredDirs.add(key);
  return dir;
}

function nearestExistingIsShared(dir: string): boolean {
  for (let p = resolve(dir); ; p = dirname(p)) {
    try {
      return (statSync(p).mode & 0o002) !== 0;
    } catch {}
    if (dirname(p) === p) {
      return false;
    }
  }
}

function isWithin(path: string, root: string): boolean {
  const rel = relative(root, path);
  return !rel.startsWith('..') && !isAbsolute(rel);
}

function untrustedReason(
  path: string,
  isLeaf: boolean,
  trusted: Set<number>
): string | undefined {
  let stats: ReturnType<typeof lstatSync>;
  try {
    stats = lstatSync(path);
  } catch {
    return undefined;
  }
  if (!trusted.has(stats.uid)) {
    return `${path} is owned by uid ${stats.uid}`;
  }
  if (!stats.isDirectory() || !(stats.mode & 0o002)) {
    return undefined;
  }
  if (isLeaf) {
    return `${path} is writable by other users`;
  }
  return stats.mode & S_ISVTX
    ? undefined
    : `${path} is writable by other users and not sticky`;
}

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
    return ensureTrustedConfiguredDir(
      absolutePath(root, cacheDirectory),
      root,
      'cache'
    );
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

/**
 * The directory each kind gets under the shared root. `workspace-data` is the
 * checkout-local name and stays that way in a checkout; what moves to the shared
 * root is only the DB, so it is named for what it holds.
 */
const SHARED_SEGMENT: Record<SharedDataKind, string> = {
  cache: 'cache',
  'workspace-data': 'databases',
};

const SHARED_DATA_KINDS = Object.keys(SHARED_SEGMENT) as SharedDataKind[];

/** Memoizes the verdict below, per repository. */
const sharedRootUsable = new Map<string, SharedDataLocation>();

/** The establish verdict is cached per process; tests need it cleared. */
export function resetSharedRootCacheForTesting() {
  sharedRootUsable.clear();
  trustedConfiguredDirs.clear();
  workspaceIds.clear();
  resolvedLocations.clear();
}

/**
 * Establishes every directory the shared layout needs, owner-only.
 *
 * All of them together, because both kinds have to reach the same verdict: a
 * run whose cache relocated while its DB did not takes a cache hit on artifacts
 * it never wrote. One answer serves both.
 */
function establishUserRoot(workspaceId: string): DirRefusal | undefined {
  if (!NX_HOME_TMP_DIR || !homeDirIsDistinctFromSharedTmp()) {
    return { kind: 'not-a-directory', dir: NX_HOME_TMP_DIR ?? '~/.nx' };
  }

  const repoRoot = join(NX_HOME_TMP_DIR, sharedDirName(workspaceId));
  const required = [
    NX_HOME_TMP_DIR,
    repoRoot,
    ...SHARED_DATA_KINDS.map((kind) => join(repoRoot, SHARED_SEGMENT[kind])),
  ];

  for (const dir of required) {
    // Non-recursive and 0700 per level, with ownership re-checked -- a level
    // left at the ambient umask is what the next run refuses.
    const result = ensureOwnedPrivateDir(dir);
    if (result.status === 'refused') {
      return result.refusal;
    }
  }
  // Both leaves, not just the cache. A sandbox policy can grant one and deny
  // the other, and establishing them says nothing about that: the mkdir is a
  // no-op on a directory that already exists and is already ours. Probing only
  // the cache would send both kinds to the shared root and then EPERM on the
  // DB -- the failure this probe exists to prevent, one directory over.
  for (const kind of SHARED_DATA_KINDS) {
    const refusal = probeWritable(join(repoRoot, SHARED_SEGMENT[kind]));
    if (refusal) {
      return refusal;
    }
  }
  return undefined;
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

/** Where this workspace can actually share, cached per identity. */
function shareableLocation(workspaceId: string): SharedDataLocation {
  const cached = sharedRootUsable.get(workspaceId);
  if (cached !== undefined) {
    return cached;
  }

  const location: SharedDataLocation = establishUserRoot(workspaceId)
    ? { share: 'none' }
    : { share: 'user', dirName: sharedDirName(workspaceId) };

  sharedRootUsable.set(workspaceId, location);
  return location;
}

/**
 * The outer segment, with the kind beneath it, so one workspace's shared data
 * is a single directory: `~/.nx/<id>/{cache,databases}`.
 *
 * Hashed rather than used raw. `generateWorkspaceId` returns the Nx Cloud
 * access token when that is the only identity available, and a token has no
 * business in a path that reaches `nx reset` output, error messages and CI
 * logs. Hashing costs nothing here: the input is already an identity, so
 * unlike a filesystem path it needs no canonicalizing or case folding.
 */
function sharedDirName(workspaceId: string): string {
  return createHash('sha256')
    .update(workspaceId)
    .digest('hex')
    .substring(0, 16);
}

/** Memoized so the git calls behind the identity happen once per process. */
const workspaceIds = new Map<string, string | null>();

/**
 * The verdict, frozen per root for the life of the process.
 *
 * `cacheDir` is a module-scope const, so the cache's answer is fixed at import.
 * Re-deciding on each call would let the DB reach a different one later in the
 * same process: `NX_CACHE_DIRECTORY` is not in `DAEMON_ENV_VARS_EXCLUSIONS` and
 * matches no prefix, so `applyDaemonEnvFromClient` can set it in the daemon
 * after startup. A first `getDbConnection()` after that would answer `none`
 * while `cacheDir` is already shared -- cache and DB in different scopes, which
 * is the torn state one predicate exists to prevent. Freezing it is what makes
 * "one decision" true over time and not just at a single call.
 */
const resolvedLocations = new Map<string, SharedDataLocation>();

/**
 * This workspace's identity, or null when it has none.
 *
 * The Nx Cloud id where there is one, else a key derived from the git remote
 * (or the first commit). Deliberately not a path: a checkout that is moved or
 * renamed keeps its identity, and every checkout of the workspace resolves to
 * the same one -- worktrees because a linked worktree is its own git top
 * level, separate clones because they share a remote.
 *
 * Null for anything with no derivable identity -- not a git repository, or a
 * shallow clone with no remote. Those keep their own copy.
 */
function workspaceIdFor(root: string): string | null {
  if (!workspaceIds.has(root)) {
    let id: string | null = null;
    try {
      // `readNxJson` throws on malformed `nx.json`, which must not take the
      // process down: this runs at module scope and there is a better error
      // waiting further in. `generateWorkspaceId` swallows its own git
      // failures.
      id = generateWorkspaceId(root, readNxJson(root));
    } catch {}
    workspaceIds.set(root, id);
  }
  return workspaceIds.get(root);
}

/**
 * Where this checkout's shared data lives.
 *
 * `none` keeps its own copy, `user` uses the per-user shared root.
 */
export type SharedDataLocation =
  | { share: 'none' }
  // The hashed directory name, never the identity it came from: that identity
  // is the Nx Cloud access token when no other one exists, and this struct is
  // exported -- one `debugLog(location)` from putting a credential in a log.
  | { share: 'user'; dirName: string };

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
 * worktrees, and an agent sandbox can be granted `~/.nx` by a committed
 * settings file where an absolute checkout path cannot (NXC-4625).
 */
export function resolveSharedDataLocation(root: string): SharedDataLocation {
  let location = resolvedLocations.get(root);
  if (location === undefined) {
    location = computeSharedDataLocation(root);
    resolvedLocations.set(root, location);
  }
  return location;
}

function computeSharedDataLocation(root: string): SharedDataLocation {
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

  // A configured location is the user's and is not ours to relocate. This
  // checkout's own configuration decides it; no other checkout is consulted.
  if (readCacheDirectoryProperty(root)) {
    return { share: 'none' };
  }

  const workspaceId = workspaceIdFor(root);
  return workspaceId ? shareableLocation(workspaceId) : { share: 'none' };
}

/**
 * The per-user directory a workspace's checkouts share for `kind`.
 *
 * It lives outside every checkout because an agent sandbox grants paths, and a
 * checkout's absolute path is different on each machine so it cannot be
 * committed to a shared settings file. This root can (NXC-4625).
 */
export function sharedUserDataDir(
  dirName: string,
  kind: SharedDataKind
): string {
  return join(NX_HOME_TMP_DIR, dirName, SHARED_SEGMENT[kind]);
}

/**
 * The directory `kind` resolves to, following the one sharing decision.
 *
 * The shared answer is the same shape for both kinds. The unshared one is not:
 * the cache honours a configured `cacheDirectory` and the lerna special case,
 * the DB honours `NX_WORKSPACE_DATA_DIRECTORY`.
 */
export function sharedDataDirectory(
  root: string,
  kind: SharedDataKind
): string {
  const location = resolveSharedDataLocation(root);
  if (location.share === 'user') {
    return sharedUserDataDir(location.dirName, kind);
  }
  return kind === 'cache'
    ? cacheDirectoryForWorkspace(root)
    : workspaceDataDirectoryForWorkspace(root);
}

/**
 * Path to the directory where Nx stores its cache.
 *
 * Normally the shared per-user directory, so every checkout of the workspace
 * uses one cache. A configured `cacheDirectory` is honored instead, resolved
 * against the root that asks -- so two checkouts share a configured location
 * only when the value is absolute. See `resolveSharedDataLocation`.
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
  const configured =
    process.env.NX_WORKSPACE_DATA_DIRECTORY ??
    process.env.NX_PROJECT_GRAPH_CACHE_DIRECTORY;
  return configured !== undefined
    ? ensureTrustedConfiguredDir(
        absolutePath(workspaceRoot, configured),
        workspaceRoot,
        'workspace data'
      )
    : defaultWorkspaceDataDirectory(workspaceRoot);
}
