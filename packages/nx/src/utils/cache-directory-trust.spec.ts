import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  statSync,
  symlinkSync,
  type Stats,
} from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs');
  return {
    ...actual,
    lstatSync: vi.fn(actual.lstatSync),
    statSync: vi.fn(actual.statSync),
  };
});

vi.mock('../config/nx-json', async () => ({
  ...(await vi.importActual('../config/nx-json')),
  readNxJson: vi.fn(() => ({})),
}));

import {
  cacheDirectoryForWorkspace,
  resetSharedRootCacheForTesting,
  UntrustedDataDirectoryError,
  workspaceDataDirectoryForWorkspace,
} from './cache-directory';

const posixOnly = process.platform === 'win32' ? describe.skip : describe;

const PEER_UID = process.getuid?.() + 1000;

let realFs: typeof import('fs');

/** Report `uid` as the owner of `paths`, standing in for another local user. */
function ownedBy(uid: number, ...paths: string[]) {
  const withOwner =
    <T extends (p: any, o?: any) => any>(real: T) =>
    (p: any, o?: any): Stats => {
      const stats = real(p, o);
      return paths.includes(String(p))
        ? Object.assign(Object.create(Object.getPrototypeOf(stats)), {
            ...stats,
            uid,
          })
        : stats;
    };
  vi.mocked(lstatSync).mockImplementation(withOwner(realFs.lstatSync) as any);
  vi.mocked(statSync).mockImplementation(withOwner(realFs.statSync) as any);
}

posixOnly('configured data directories', () => {
  let base: string;
  let workspace: string;

  beforeAll(async () => {
    realFs = await vi.importActual('fs');
  });

  beforeEach(() => {
    base = mkdtempSync(join(tmpdir(), 'nx-data-dir-'));
    workspace = join(base, 'workspace');
    mkdirSync(workspace);
    resetSharedRootCacheForTesting();
    delete process.env.NX_CACHE_DIRECTORY;
    delete process.env.NX_WORKSPACE_DATA_DIRECTORY;
    delete process.env.NX_PROJECT_GRAPH_CACHE_DIRECTORY;
    delete process.env.NX_ALLOW_INSECURE_DIRECTORIES;
  });

  afterEach(() => {
    vi.mocked(lstatSync).mockImplementation(realFs.lstatSync);
    vi.mocked(statSync).mockImplementation(realFs.statSync);
    delete process.env.NX_CACHE_DIRECTORY;
    delete process.env.NX_WORKSPACE_DATA_DIRECTORY;
    delete process.env.NX_ALLOW_INSECURE_DIRECTORIES;
    vi.restoreAllMocks();
    rmSync(base, { recursive: true, force: true });
  });

  const resolvers = [
    ['NX_CACHE_DIRECTORY', cacheDirectoryForWorkspace],
    ['NX_WORKSPACE_DATA_DIRECTORY', workspaceDataDirectoryForWorkspace],
  ] as const;

  describe.each(resolvers)('%s', (envVar, resolveDir) => {
    const configure = (dir: string) => {
      process.env[envVar] = dir;
    };

    it('refuses a directory another user created first', () => {
      const dir = join(base, 'mycache');
      mkdirSync(dir);
      chmodSync(dir, 0o777);
      ownedBy(PEER_UID, dir);
      configure(dir);

      expect(() => resolveDir(workspace)).toThrow(UntrustedDataDirectoryError);
    });

    it('names the opt-out when it refuses', () => {
      const dir = join(base, 'mycache');
      mkdirSync(dir);
      ownedBy(PEER_UID, dir);
      configure(dir);
      process.env.NX_ALLOW_INSECURE_DIRECTORIES = 'false';

      expect(() => resolveDir(workspace)).toThrow(
        /NX_ALLOW_INSECURE_DIRECTORIES=true/
      );
    });

    it('uses a directory another user owns when NX_ALLOW_INSECURE_DIRECTORIES is true, warning once', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const dir = join(base, 'mycache');
      mkdirSync(dir);
      ownedBy(PEER_UID, dir);
      configure(dir);
      process.env.NX_ALLOW_INSECURE_DIRECTORIES = 'true';

      expect(resolveDir(workspace)).toBe(dir);
      expect(resolveDir(workspace)).toBe(dir);
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0][0]).toContain(dir);
    });

    it('refuses a world-writable directory', () => {
      const dir = join(base, 'mycache');
      mkdirSync(dir);
      chmodSync(dir, 0o777);
      configure(dir);

      expect(() => resolveDir(workspace)).toThrow(/writable by other users/);
    });

    it('refuses a directory under a parent another user owns', () => {
      const parent = join(base, 'parent');
      mkdirSync(parent);
      ownedBy(PEER_UID, parent);
      configure(join(parent, 'mycache'));

      expect(() => resolveDir(workspace)).toThrow(
        new RegExp(`owned by uid ${PEER_UID}`)
      );
    });

    it('refuses a directory under a world-writable parent that is not sticky', () => {
      const parent = join(base, 'parent');
      mkdirSync(parent);
      chmodSync(parent, 0o777);
      configure(join(parent, 'mycache'));

      expect(() => resolveDir(workspace)).toThrow(/not sticky/);
    });

    it('refuses a symlink another user owns, even to our own directory', () => {
      const real = join(base, 'real');
      mkdirSync(real);
      const link = join(base, 'link');
      symlinkSync(real, link);
      ownedBy(PEER_UID, link);
      configure(link);

      expect(() => resolveDir(workspace)).toThrow(UntrustedDataDirectoryError);
    });

    it('creates a missing directory under a sticky shared parent', () => {
      const shared = join(base, 'shared');
      mkdirSync(shared);
      chmodSync(shared, 0o1777);
      const dir = join(shared, 'mycache');
      configure(dir);

      expect(resolveDir(workspace)).toBe(dir);
      expect(statSync(dir).isDirectory()).toBe(true);
      expect(statSync(dir).mode & 0o002).toBe(0);
    });

    it('leaves a missing directory under a private parent uncreated', () => {
      const dir = join(base, 'private', 'mycache');
      configure(dir);

      expect(resolveDir(workspace)).toBe(dir);
      expect(existsSync(join(base, 'private'))).toBe(false);
    });

    it('accepts group-writable directories without changing their mode', () => {
      const parent = join(base, 'parent');
      mkdirSync(parent);
      chmodSync(parent, 0o775);
      const dir = join(parent, 'mycache');
      mkdirSync(dir);
      chmodSync(dir, 0o775);
      configure(dir);

      expect(resolveDir(workspace)).toBe(dir);
      expect(statSync(dir).mode & 0o777).toBe(0o775);
    });

    it('accepts our own symlink to our own directory', () => {
      const real = join(base, 'real');
      mkdirSync(real);
      const link = join(base, 'link');
      symlinkSync(real, link);
      configure(link);

      expect(resolveDir(workspace)).toBe(link);
    });

    it('trusts the owner of the workspace', () => {
      const dir = join(base, 'mycache');
      mkdirSync(dir);
      ownedBy(PEER_UID, dir, workspace);
      configure(dir);

      expect(resolveDir(workspace)).toBe(dir);
    });

    it('trusts directories inside the workspace', () => {
      const dir = join(workspace, 'cache');
      mkdirSync(dir);
      chmodSync(dir, 0o777);
      configure('cache');

      expect(resolveDir(workspace)).toBe(dir);
    });
  });
});
