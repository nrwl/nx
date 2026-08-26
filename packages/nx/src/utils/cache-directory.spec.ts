import type { MockedFunction } from 'vitest';
vi.mock('../native', async () => ({
  getMainWorktreeRoot: vi.fn(),
}));

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
import { getMainWorktreeRoot } from '../native';
import {
  resetSharedRootCacheForTesting,
  resolveSharedDataLocation,
  type SharedDataKind,
  sharedUserDataDir,
} from './cache-directory';
import { NX_HOME_TMP_DIR, NX_TMP_DIR } from './nx-tmp-dir';
import { canonicalDir, ensureOwnedPrivateDir } from './owned-private-dir';

const mockEnsureOwnedPrivateDir = ensureOwnedPrivateDir as MockedFunction<
  typeof ensureOwnedPrivateDir
>;
const mockCanonicalDir = canonicalDir as MockedFunction<typeof canonicalDir>;

const mockReadNxJson = readNxJson as MockedFunction<typeof readNxJson>;
const mockWriteFileSync = writeFileSync as MockedFunction<typeof writeFileSync>;
const mockUnlinkSync = unlinkSync as MockedFunction<typeof unlinkSync>;

/** Stage each root's `nx.json` `cacheDirectory`; `undefined` means unset. */
const stageCacheDirectoryConfig = (
  config: Record<string, string | undefined>
) =>
  mockReadNxJson.mockImplementation(
    (root: string) => ({ cacheDirectory: config[root] }) as any
  );

/**
 * The per-user path a consumer would get, or `undefined` when this checkout
 * keeps its own copy or shares through the main checkout. Stands in for what
 * `sharedDataDirectory` resolves to without needing its `perWorkspace` half.
 */
const sharedUserDirFor = (root: string, kind: SharedDataKind) => {
  const location = resolveSharedDataLocation(root);
  return location.share === 'user'
    ? sharedUserDataDir(location.mainRoot, kind)
    : undefined;
};

/** Where worktrees of `mainRoot` are expected to share `kind`. */
const sharedDirFor = (mainRoot: string, kind: 'cache' | 'workspace-data') =>
  join(
    NX_HOME_TMP_DIR,
    createHash('sha256')
      .update(mainRoot.toLowerCase())
      .digest('hex')
      .substring(0, 16),
    kind
  );

const mockGetMainWorktreeRoot = getMainWorktreeRoot as MockedFunction<
  typeof getMainWorktreeRoot
>;

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
    mockGetMainWorktreeRoot.mockReturnValue('/main');
    // clearAllMocks drops implementations too, so restore the permissive
    // defaults; rows that need a refusal override them.
    mockEnsureOwnedPrivateDir.mockImplementation((dir: string) => ({
      status: 'ok',
      path: dir as any,
    }));
    mockCanonicalDir.mockImplementation((dir: string) => dir);
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
      sharedDirFor('/main', 'cache')
    );
    expect(sharedUserDirFor('/worktree', 'workspace-data')).toBe(
      sharedDirFor('/main', 'workspace-data')
    );
  });

  it('nests both kinds under one per-repository directory', () => {
    // Pinned literally rather than derived, so a change to the layout has to
    // be made here on purpose. `~/.nx/<hash>/<kind>` and not
    // `~/.nx/<kind>/<hash>`: one repository's worktree data is one directory,
    // which is also what lets a future sweep reclaim it in a single unlink.
    mockGetMainWorktreeRoot.mockReturnValue('/main');
    const hash = createHash('sha256')
      .update('/main')
      .digest('hex')
      .substring(0, 16);

    expect(sharedUserDirFor('/worktree', 'cache')).toBe(
      join(NX_HOME_TMP_DIR, hash, 'cache')
    );
    expect(sharedUserDirFor('/worktree', 'workspace-data')).toBe(
      join(NX_HOME_TMP_DIR, hash, 'workspace-data')
    );
  });

  it('keeps cache and workspace-data apart', () => {
    expect(sharedUserDirFor('/worktree', 'cache')).not.toBe(
      sharedUserDirFor('/worktree', 'workspace-data')
    );
  });

  it('gives every worktree of one repo the same directory, and two repos different ones', () => {
    // Sharing is the point: a second worktree that computed its own directory
    // would rebuild a cache the first one already has.
    mockGetMainWorktreeRoot.mockReturnValue('/main');
    const fromA = sharedUserDirFor('/worktree-a', 'cache');
    const fromB = sharedUserDirFor('/worktree-b', 'cache');
    expect(fromA).toBe(fromB);

    mockGetMainWorktreeRoot.mockReturnValue('/other-clone');
    expect(sharedUserDirFor('/worktree-a', 'cache')).not.toBe(fromA);
  });

  it('relocates a plain checkout too, keyed on itself', () => {
    // `getMainWorktreeRoot` returns null both for the main checkout of a repo
    // and for a directory that is not a git repo at all. Either way it keys
    // the shared directory itself, so a main checkout and any worktree added
    // to it later land on the same directory rather than diverging the moment
    // the first `git worktree add` happens.
    mockGetMainWorktreeRoot.mockReturnValue(null);

    expect(sharedUserDirFor('/plain-checkout', 'cache')).toBe(
      sharedDirFor('/plain-checkout', 'cache')
    );
  });

  it('agrees between a main checkout and its worktrees', () => {
    mockGetMainWorktreeRoot.mockReturnValue(null);
    const fromMain = sharedUserDirFor('/main', 'cache');

    mockGetMainWorktreeRoot.mockReturnValue('/main');
    expect(sharedUserDirFor('/worktree', 'cache')).toBe(fromMain);
  });

  it('keys on the local root when worktree detection fails', () => {
    mockGetMainWorktreeRoot.mockImplementation(() => {
      throw new Error('not a git worktree');
    });

    expect(sharedUserDirFor('/worktree', 'cache')).toBe(
      sharedDirFor('/worktree', 'cache')
    );
  });

  describe('a configured cacheDirectory', () => {
    it('shares through the main checkout when both configure the same value', () => {
      stageCacheDirectoryConfig({
        '/worktree': '.nx/cache',
        '/main': '.nx/cache',
      });

      // Both are naming one location, so they can still share it -- but via the
      // main checkout rather than the per-user root, since the user chose where.
      expect(resolveSharedDataLocation('/worktree')).toEqual({
        share: 'main',
        mainRoot: '/main',
      });
      expect(sharedUserDirFor('/worktree', 'cache')).toBeUndefined();
    });

    it('keeps its own copy when the two checkouts configure different values', () => {
      stageCacheDirectoryConfig({
        '/worktree': '.nx/branch-cache',
        '/main': '.nx/cache',
      });

      expect(resolveSharedDataLocation('/worktree')).toEqual({
        share: 'none',
      });
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
      // `getSharedWorktreeDataDir` is what returned that per-user path. Once
      // anything pins a location it must return undefined for BOTH kinds, so
      // there is no per-user path for either consumer to drift onto.
      const pinned = [
        () =>
          stageCacheDirectoryConfig({
            '/worktree': '.nx/c',
            '/main': '.nx/c',
          }),
        () =>
          stageCacheDirectoryConfig({
            '/worktree': '.nx/c',
            '/main': '.nx/other',
          }),
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
        // Unpinned, the per-user root is on offer -- so the assertions below
        // are testing the pin, not a function that always returns undefined.
        expect(sharedUserDirFor('/worktree', 'cache')).toBe(
          sharedDirFor('/main', 'cache')
        );

        pin();
        expect(sharedUserDirFor('/worktree', 'cache')).toBeUndefined();
        expect(sharedUserDirFor('/worktree', 'workspace-data')).toBeUndefined();
      }
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

    it('removes the marker it wrote', () => {
      expect(sharedUserDirFor('/worktree', 'cache')).toBe(
        sharedDirFor('/main', 'cache')
      );

      const written = mockWriteFileSync.mock.calls[0][0] as string;
      expect(written).toContain(sharedDirFor('/main', 'cache'));
      expect(mockUnlinkSync).toHaveBeenCalledWith(written);
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
        share: 'main',
        mainRoot: '/main',
      });
      expect(sharedUserDirFor('/worktree', 'cache')).toBeUndefined();
    });

    it('falls back to the main checkout when ~/.nx belongs to someone else', () => {
      // A `sudo nx` that kept HOME leaves ~/.nx owned by root. That says
      // nothing about the main checkout, which this user still owns.
      mockEnsureOwnedPrivateDir.mockImplementation((dir: string) =>
        dir === NX_HOME_TMP_DIR
          ? ({
              status: 'refused',
              refusal: { kind: 'foreign-owner', dir, uid: 0 },
            } as any)
          : ({ status: 'ok', path: dir } as any)
      );

      expect(resolveSharedDataLocation('/worktree')).toEqual({
        share: 'main',
        mainRoot: '/main',
      });
    });

    it.each(['EPERM', 'EACCES', 'EROFS'])(
      'keeps its own copy when mkdir is denied with %s',
      (code) => {
        // What an agent sandbox does: deny the mkdir outright. The main
        // checkout is outside that sandbox too, so falling back there would
        // fail the same way. Testing the mkdir rather than the agent's name is
        // what makes this cover agents Nx has never heard of.
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

    it('still reaches the main checkout when mkdir fails for an unrelated reason', () => {
      // ENOSPC is not confinement. Telling it apart from a sandbox denial is
      // the whole job of the errno check.
      mockEnsureOwnedPrivateDir.mockImplementation(
        (dir: string) =>
          ({
            status: 'refused',
            refusal: { kind: 'not-created', dir, code: 'ENOSPC' },
          }) as any
      );

      expect(resolveSharedDataLocation('/worktree')).toEqual({
        share: 'main',
        mainRoot: '/main',
      });
    });

    it('establishes both kinds together, so neither can relocate alone', () => {
      // The cache and the DB indexing it must reach the same verdict. If only
      // the cache leaf were establishable, relocating it alone would strand
      // the DB -- so a refusal anywhere sends both to the main checkout.
      mockEnsureOwnedPrivateDir.mockImplementation((dir: string) =>
        dir.includes('workspace-data')
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
        sharedDirFor('/main', 'cache')
      );

      const guarded = mockEnsureOwnedPrivateDir.mock.calls.map((c) => c[0]);
      expect(guarded).toContain(NX_HOME_TMP_DIR);
      // The per-repo directory, then each kind beneath it.
      expect(guarded).toContain(dirname(sharedDirFor('/main', 'cache')));
      expect(guarded).toContain(sharedDirFor('/main', 'cache'));
      expect(guarded).toContain(sharedDirFor('/main', 'workspace-data'));
    });
  });
});
