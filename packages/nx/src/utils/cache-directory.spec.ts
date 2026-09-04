import type { MockedFunction } from 'vitest';
vi.mock('./workspace-id', async () => ({
  ...(await vi.importActual('./workspace-id')),
  generateWorkspaceId: vi.fn(),
}));

// Defaulted off rather than read from the environment: `isCI` consults ~18
// variables, and the runner this suite executes on sets them, so every sharing
// row below would answer `none` there and `user` on a laptop.
vi.mock('./is-ci', () => ({ isCI: vi.fn(() => false) }));

vi.mock('./owned-private-dir', async () => {
  const actual = await vi.importActual('./owned-private-dir');
  return {
    ...actual,
    // Stubbed so the suite neither depends on nor writes to the runner's real
    // home. Rows that need a refusal override it.
    ensureOwnedPrivateDir: vi.fn((dir: string) => ({
      status: 'ok',
      path: dir,
    })),
    canonicalDir: vi.fn((dir: string) => dir),
  };
});

vi.mock('fs', async () => ({
  ...(await vi.importActual('fs')),
  writeFileSync: vi.fn(),
  unlinkSync: vi.fn(),
}));

vi.mock('../config/nx-json', async () => ({
  ...(await vi.importActual('../config/nx-json')),
  readNxJson: vi.fn(() => ({})),
}));

import { createHash } from 'crypto';
import { dirname, join } from 'path';
import { unlinkSync, writeFileSync } from 'fs';
import { readNxJson } from '../config/nx-json';
import {
  resetSharedRootCacheForTesting,
  resolveSharedDataLocation,
  sharedDataDirectory,
  type SharedDataKind,
  sharedUserDataDir,
} from './cache-directory';
import { isCI } from './is-ci';
import { NX_HOME_TMP_DIR, NX_TMP_DIR } from './nx-tmp-dir';
import { canonicalDir, ensureOwnedPrivateDir } from './owned-private-dir';
import { generateWorkspaceId } from './workspace-id';

const mockEnsureOwnedPrivateDir = ensureOwnedPrivateDir as MockedFunction<
  typeof ensureOwnedPrivateDir
>;
const mockCanonicalDir = canonicalDir as MockedFunction<typeof canonicalDir>;
const mockReadNxJson = readNxJson as MockedFunction<typeof readNxJson>;
const mockWriteFileSync = writeFileSync as MockedFunction<typeof writeFileSync>;
const mockUnlinkSync = unlinkSync as MockedFunction<typeof unlinkSync>;
const mockGenerateWorkspaceId = generateWorkspaceId as MockedFunction<
  typeof generateWorkspaceId
>;
const mockIsCI = isCI as MockedFunction<typeof isCI>;

/** A stand-in for the repo key `deriveRepoKey` produces. */
const WORKSPACE_ID = 'github.com/acme/repo#';

/** The directory each kind gets under the shared root. */
const SEGMENT: Record<SharedDataKind, string> = {
  cache: 'cache',
  'workspace-data': 'databases',
};

/** Stage this checkout's `nx.json` `cacheDirectory`; `undefined` means unset. */
const stageCacheDirectoryConfig = (
  config: Record<string, string | undefined>
) =>
  mockReadNxJson.mockImplementation(
    (root: string) => ({ cacheDirectory: config[root] }) as any
  );

/**
 * The per-user path a consumer would get, or `undefined` when this checkout
 * keeps its own copy. Stands in for what `sharedDataDirectory` resolves to,
 * without going through its unshared half.
 */
const sharedUserDirFor = (root: string, kind: SharedDataKind) => {
  const location = resolveSharedDataLocation(root);
  return location.share === 'user'
    ? sharedUserDataDir(location.dirName, kind)
    : undefined;
};

/** Where checkouts sharing `workspaceId` are expected to share `kind`. */
const sharedDirFor = (workspaceId: string, kind: SharedDataKind) =>
  join(
    NX_HOME_TMP_DIR,
    createHash('sha256').update(workspaceId).digest('hex').substring(0, 16),
    SEGMENT[kind]
  );

describe('shared data location', () => {
  const cacheEnvVars = [
    'NX_CACHE_DIRECTORY',
    'NX_WORKSPACE_DATA_DIRECTORY',
    'NX_PROJECT_GRAPH_CACHE_DIRECTORY',
  ];
  const originalEnv: Record<string, string | undefined> = {};

  beforeAll(() => {
    for (const key of cacheEnvVars) {
      originalEnv[key] = process.env[key];
    }
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockGenerateWorkspaceId.mockReturnValue(WORKSPACE_ID);
    // clearAllMocks drops implementations too, so restore the permissive
    // defaults; rows that need a refusal override them.
    mockEnsureOwnedPrivateDir.mockImplementation((dir: string) => ({
      status: 'ok',
      path: dir as any,
    }));
    mockCanonicalDir.mockImplementation((dir: string) => dir);
    mockIsCI.mockReturnValue(false);
    // Same reason: a prior row's staged nx.json would otherwise still be in
    // place and silently make this row a configured-cacheDirectory case.
    mockReadNxJson.mockImplementation(() => ({}) as any);
    mockWriteFileSync.mockImplementation(() => undefined);
    for (const key of cacheEnvVars) {
      delete process.env[key];
    }
    resetSharedRootCacheForTesting();
  });

  afterAll(() => {
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  it('shares a home-rooted directory per kind', () => {
    expect(sharedUserDirFor('/worktree', 'cache')).toBe(
      sharedDirFor(WORKSPACE_ID, 'cache')
    );
    expect(sharedUserDirFor('/worktree', 'workspace-data')).toBe(
      sharedDirFor(WORKSPACE_ID, 'workspace-data')
    );
  });

  it('nests both kinds under one per-workspace directory', () => {
    // Pinned literally rather than derived, so a change to the layout has to
    // be made here on purpose. `~/.nx/<id>/<segment>` and not
    // `~/.nx/<segment>/<id>`: one workspace's shared data is one directory,
    // which is also what lets a future sweep reclaim it in a single unlink.
    // The DB's segment is `databases`, not `workspace-data`: only the DB moves
    // out of the checkout, so it is named for what it holds.
    const id = createHash('sha256')
      .update(WORKSPACE_ID)
      .digest('hex')
      .substring(0, 16);

    expect(sharedUserDirFor('/worktree', 'cache')).toBe(
      join(NX_HOME_TMP_DIR, id, 'cache')
    );
    expect(sharedUserDirFor('/worktree', 'workspace-data')).toBe(
      join(NX_HOME_TMP_DIR, id, 'databases')
    );
  });

  it('keeps cache and workspace-data apart', () => {
    expect(sharedUserDirFor('/worktree', 'cache')).not.toBe(
      sharedUserDirFor('/worktree', 'workspace-data')
    );
  });

  describe('the workspace identity', () => {
    it('gives every checkout sharing an identity the same directory', () => {
      // Sharing is the point: a second worktree that computed its own
      // directory would rebuild a cache the first one already has. The
      // identity does not depend on the path, so it holds for a main checkout
      // and its worktrees alike.
      const fromMain = sharedUserDirFor('/main', 'cache');
      const fromWorktreeA = sharedUserDirFor('/wt-a', 'cache');
      const fromWorktreeB = sharedUserDirFor('/somewhere/else/wt-b', 'cache');

      expect(fromWorktreeA).toBe(fromMain);
      expect(fromWorktreeB).toBe(fromMain);
    });

    it('survives a rename of the checkout', () => {
      // The whole reason for keying on identity rather than a path: renaming
      // or moving a checkout used to strand its cache and start a new one.
      const before = sharedUserDirFor('/repos/app', 'cache');

      resetSharedRootCacheForTesting();
      const afterRename = sharedUserDirFor('/repos/app-renamed', 'cache');

      expect(afterRename).toBe(before);
    });

    it('gives a different workspace a different directory', () => {
      const ours = sharedUserDirFor('/worktree', 'cache');

      mockGenerateWorkspaceId.mockReturnValue('github.com/acme/other#');
      resetSharedRootCacheForTesting();

      expect(sharedUserDirFor('/worktree', 'cache')).not.toBe(ours);
    });

    it('hashes the identity, so a cloud token never lands in a path', () => {
      // `generateWorkspaceId` returns `nxCloudAccessToken` when that is the
      // only identity available. That value reaches `nx reset` output, error
      // messages and CI logs if it is used raw as a directory name.
      const token = 'nxcloud-secret-token-value';
      mockGenerateWorkspaceId.mockReturnValue(token);

      const dir = sharedUserDirFor('/worktree', 'cache');

      expect(dir).toBe(sharedDirFor(token, 'cache'));
      expect(dir).not.toContain(token);
    });

    it('never carries the raw identity in the resolved location', () => {
      // The struct is exported. `generateWorkspaceId` returns the Nx Cloud
      // access token when that is the only identity, so carrying it here would
      // be one `debugLog(location)` away from putting a credential in a log.
      const token = 'nxcloud_SUPER_SECRET_TOKEN';
      mockGenerateWorkspaceId.mockReturnValue(token);

      const location = resolveSharedDataLocation('/worktree');

      expect(location.share).toBe('user');
      expect(JSON.stringify(location)).not.toContain(token);
    });

    it('keeps its own copy when the workspace has no identity', () => {
      // Not a git repository, or a shallow clone with no remote. There is
      // nothing stable to key a shared directory on.
      mockGenerateWorkspaceId.mockReturnValue(null);

      expect(resolveSharedDataLocation('/worktree')).toEqual({
        share: 'none',
      });
    });

    it('keeps its own copy when reading nx.json throws', () => {
      // Malformed `nx.json`. This runs at module scope, so it must not take
      // the process down; there is a better error waiting further in.
      mockReadNxJson.mockImplementation(() => {
        throw new Error('unexpected token');
      });

      expect(resolveSharedDataLocation('/worktree')).toEqual({
        share: 'none',
      });
    });
  });

  describe('a configured cacheDirectory', () => {
    it('keeps its own copy, wherever the user pointed it', () => {
      // A configured location is the user's and is not ours to relocate. Only
      // this checkout's configuration is consulted.
      stageCacheDirectoryConfig({ '/worktree': '.nx/cache' });

      expect(resolveSharedDataLocation('/worktree')).toEqual({
        share: 'none',
      });
    });

    it('freezes the verdict for the life of the process', () => {
      // `cacheDir` is a module-scope const, so the cache's answer is fixed at
      // import. The daemon reflects client env after startup via
      // `applyDaemonEnvFromClient`, and NX_CACHE_DIRECTORY is in no exclusion
      // list -- so re-deciding on each call would let a later
      // `getDbConnection()` answer `none` while `cacheDir` is already shared.
      // Cache and DB in different scopes is the torn state one predicate
      // exists to prevent.
      const first = resolveSharedDataLocation('/worktree');
      expect(first.share).toBe('user');

      process.env.NX_CACHE_DIRECTORY = '/pinned-after-the-fact';

      expect(resolveSharedDataLocation('/worktree')).toEqual(first);
    });

    it('keeps its own copy when an env var pins the location', () => {
      // Set on the process, so it names one directory whichever checkout asks.
      process.env.NX_WORKSPACE_DATA_DIRECTORY = '/pinned';

      expect(resolveSharedDataLocation('/worktree')).toEqual({
        share: 'none',
      });
    });

    it('never offers the per-user root once a location is configured', () => {
      // The bug this guards: the cache dir and the DB that indexes it tested
      // "is it configured?" differently, so the cache could stay per-worktree
      // while the DB went to the shared per-user root. A sibling worktree then
      // hit a `cache_outputs` row whose artifacts it had never written, and
      // `finalizeCacheHits` still called that `local-cache` -- a green cache
      // hit that restored nothing.
      //
      // `sharedUserDataDir` is what returns that per-user path. Once anything
      // pins a location it must return undefined for BOTH kinds, so there is
      // no per-user path for either consumer to drift onto.
      const pinned = [
        () => stageCacheDirectoryConfig({ '/worktree': '.nx/c' }),
        () => {
          process.env.NX_WORKSPACE_DATA_DIRECTORY = '/pinned';
        },
        () => {
          process.env.NX_CACHE_DIRECTORY = '/pinned';
        },
      ];

      for (const pin of pinned) {
        stageCacheDirectoryConfig({});
        delete process.env.NX_WORKSPACE_DATA_DIRECTORY;
        delete process.env.NX_CACHE_DIRECTORY;
        resetSharedRootCacheForTesting();
        // Unpinned, the per-user root is on offer -- so the assertions below
        // are testing the pin, not a function that always returns undefined.
        expect(sharedUserDirFor('/worktree', 'cache')).toBe(
          sharedDirFor(WORKSPACE_ID, 'cache')
        );

        pin();
        // The verdict is frozen per process, so a pin applied after one was
        // already reached does not move it -- that freeze is what keeps the
        // cache and the DB from answering differently later in the same
        // process. Reset to model a process that starts with the pin in place,
        // which is how a user actually sets one.
        resetSharedRootCacheForTesting();

        expect(sharedUserDirFor('/worktree', 'cache')).toBeUndefined();
        expect(sharedUserDirFor('/worktree', 'workspace-data')).toBeUndefined();
      }
    });
  });

  describe('a CI runner', () => {
    it('keeps both kinds in the checkout', () => {
      mockIsCI.mockReturnValue(true);

      expect(resolveSharedDataLocation('/worktree')).toEqual({
        share: 'none',
      });
      expect(sharedDataDirectory('/worktree', 'cache')).toBe(
        join('/worktree', '.nx', 'cache')
      );
      expect(sharedDataDirectory('/worktree', 'workspace-data')).toBe(
        join('/worktree', '.nx', 'workspace-data')
      );
    });

    it('settles before anything reaches git or the filesystem', () => {
      mockIsCI.mockReturnValue(true);

      resolveSharedDataLocation('/worktree');

      expect(mockGenerateWorkspaceId).not.toHaveBeenCalled();
      expect(mockWriteFileSync).not.toHaveBeenCalled();
    });

    it('still honors a configured cacheDirectory', () => {
      mockIsCI.mockReturnValue(true);
      stageCacheDirectoryConfig({ '/worktree': '.nx/other' });

      expect(sharedDataDirectory('/worktree', 'cache')).toBe(
        join('/worktree', '.nx', 'other')
      );
    });
  });

  describe('the write probe', () => {
    it.each(['EPERM', 'EACCES', 'EROFS'])(
      'keeps its own copy when writing under the shared root is denied with %s',
      (code) => {
        // The directories already exist, which is the normal case: any
        // unsandboxed run in this repo created them. `ensureOwnedPrivateDir`
        // then tolerates EEXIST and writes nothing, so the mkdir probe alone
        // reports success for a sandbox that denies every write under ~/.nx --
        // and the agent EPERMs on its first cache write instead of getting the
        // local fallback this exists for.
        mockWriteFileSync.mockImplementation(() => {
          throw Object.assign(new Error(code), { code });
        });

        expect(resolveSharedDataLocation('/worktree')).toEqual({
          share: 'none',
        });
      }
    );

    it('keeps its own copy when only the databases leaf is unwritable', () => {
      // A sandbox policy can grant one leaf and deny the other. Establishing
      // says nothing about it -- the mkdir is a no-op on a directory that
      // already exists and is already ours -- so probing only the cache would
      // send both kinds to the shared root and then EPERM on the DB.
      mockWriteFileSync.mockImplementation((target: any) => {
        if (String(target).includes('databases')) {
          throw Object.assign(new Error('EACCES'), { code: 'EACCES' });
        }
        return undefined;
      });

      expect(resolveSharedDataLocation('/worktree')).toEqual({
        share: 'none',
      });
    });

    it('removes the marker it wrote', () => {
      expect(sharedUserDirFor('/worktree', 'cache')).toBe(
        sharedDirFor(WORKSPACE_ID, 'cache')
      );

      const written = mockWriteFileSync.mock.calls[0][0] as string;
      expect(written).toContain(sharedDirFor(WORKSPACE_ID, 'cache'));
      expect(mockUnlinkSync).toHaveBeenCalledWith(written);
    });

    it('creates the marker exclusively, at a name a peer cannot predict', () => {
      // `~/.nx` is writable by a sandboxed agent sharing our uid, so a symlink
      // planted at the marker path would be followed by a plain write --
      // truncating whatever it points at, outside the granted root, and still
      // reporting the root writable. `wx` refuses to follow it, and an
      // unguessable name means there is nothing to aim at in the first place.
      expect(sharedUserDirFor('/worktree', 'cache')).toBe(
        sharedDirFor(WORKSPACE_ID, 'cache')
      );
      expect(mockWriteFileSync).toHaveBeenCalledWith(expect.any(String), '', {
        flag: 'wx',
      });

      const first = mockWriteFileSync.mock.calls[0][0] as string;
      resetSharedRootCacheForTesting();
      expect(sharedUserDirFor('/worktree', 'cache')).toBe(
        sharedDirFor(WORKSPACE_ID, 'cache')
      );
      const second = mockWriteFileSync.mock.calls.at(-1)[0] as string;
      expect(second).not.toBe(first);
    });
  });

  describe('sharedDataDirectory', () => {
    // The rest of this file goes through `resolveSharedDataLocation`. These
    // exercise the exported dispatch every consumer actually calls, so a
    // regression in it cannot pass while the decision underneath stays right.
    it('sends both kinds to the shared root when it is usable', () => {
      expect(sharedDataDirectory('/worktree', 'cache')).toBe(
        sharedDirFor(WORKSPACE_ID, 'cache')
      );
      expect(sharedDataDirectory('/worktree', 'workspace-data')).toBe(
        sharedDirFor(WORKSPACE_ID, 'workspace-data')
      );
    });

    it('keeps both kinds in this checkout when it shares nothing', () => {
      stageCacheDirectoryConfig({ '/worktree': '.nx/other' });

      expect(sharedDataDirectory('/worktree', 'cache')).toBe(
        join('/worktree', '.nx', 'other')
      );
      expect(sharedDataDirectory('/worktree', 'workspace-data')).toBe(
        join('/worktree', '.nx', 'workspace-data')
      );
    });
  });

  describe('the shared root guards', () => {
    it('refuses ~/.nx when it is the world-writable shared container', () => {
      // homedir() honours $HOME, so HOME=/tmp makes ~/.nx the 1777 container
      // any local peer can create subtrees under. Build outputs get replayed
      // into the workspace, so they cannot live there.
      mockCanonicalDir.mockImplementation((dir: string) =>
        dir === NX_HOME_TMP_DIR || dir === NX_TMP_DIR ? '/tmp/.nx' : dir
      );

      expect(resolveSharedDataLocation('/worktree')).toEqual({
        share: 'none',
      });
      expect(sharedUserDirFor('/worktree', 'cache')).toBeUndefined();
    });

    it('keeps its own copy when ~/.nx belongs to someone else', () => {
      // A `sudo nx` that kept HOME leaves ~/.nx owned by root.
      mockEnsureOwnedPrivateDir.mockImplementation((dir: string) =>
        dir === NX_HOME_TMP_DIR
          ? ({
              status: 'refused',
              refusal: { kind: 'foreign-owner', dir, uid: 0 },
            } as any)
          : ({ status: 'ok', path: dir } as any)
      );

      expect(resolveSharedDataLocation('/worktree')).toEqual({
        share: 'none',
      });
    });

    it.each(['EPERM', 'EACCES', 'EROFS'])(
      'keeps its own copy when mkdir is denied with %s',
      (code) => {
        // What an agent sandbox does: deny the mkdir outright. Testing the
        // mkdir rather than the agent's name is what makes this cover agents
        // Nx has never heard of.
        mockEnsureOwnedPrivateDir.mockImplementation(
          (dir: string) =>
            ({
              status: 'refused',
              refusal: { kind: 'not-created', dir, code },
            }) as any
        );

        expect(resolveSharedDataLocation('/worktree')).toEqual({
          share: 'none',
        });
        expect(sharedUserDirFor('/worktree', 'cache')).toBeUndefined();
      }
    );

    it('establishes both kinds together, so neither can relocate alone', () => {
      // The cache and the DB indexing it must reach the same verdict. If only
      // the cache leaf were establishable, relocating it alone would strand
      // the DB -- so a refusal anywhere keeps both in the checkout.
      mockEnsureOwnedPrivateDir.mockImplementation((dir: string) =>
        dir.includes('databases')
          ? ({
              status: 'refused',
              refusal: { kind: 'not-created', dir },
            } as any)
          : ({ status: 'ok', path: dir } as any)
      );

      expect(sharedUserDirFor('/worktree', 'cache')).toBeUndefined();
      expect(sharedUserDirFor('/worktree', 'workspace-data')).toBeUndefined();
    });

    it('establishes each level owner-only before handing the path back', () => {
      expect(sharedUserDirFor('/worktree', 'cache')).toBe(
        sharedDirFor(WORKSPACE_ID, 'cache')
      );

      const guarded = mockEnsureOwnedPrivateDir.mock.calls.map((c) => c[0]);
      expect(guarded).toContain(NX_HOME_TMP_DIR);
      // The per-workspace directory, then each segment beneath it.
      expect(guarded).toContain(dirname(sharedDirFor(WORKSPACE_ID, 'cache')));
      expect(guarded).toContain(sharedDirFor(WORKSPACE_ID, 'cache'));
      expect(guarded).toContain(sharedDirFor(WORKSPACE_ID, 'workspace-data'));
    });
  });
});
