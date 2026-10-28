const mockExecAndWait = vi.fn();
vi.mock('./utils/child-process-utils', () => ({
  execAndWait: (...args: unknown[]) => mockExecAndWait(...args),
}));

vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs');
  return { ...actual, lstatSync: vi.fn(actual.lstatSync) };
});

import {
  chmodSync,
  existsSync,
  lstatSync,
  lutimesSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  realpathSync,
  rmSync,
  statSync,
  symlinkSync,
  utimesSync,
  writeFileSync,
} from 'fs';
import { dirname, join, relative } from 'path';

describe('createSandbox', () => {
  let root: string;

  let previousUmask: number;

  beforeEach(() => {
    previousUmask = process.umask(0o022);
    // Outside the shared temp dir, which is refused as a home.
    const parent = join(process.cwd(), 'tmp');
    mkdirSync(parent, { recursive: true });
    root = realpathSync(mkdtempSync(join(parent, 'cnw-sandbox-')));
    mockExecAndWait.mockReset().mockResolvedValue({ code: 0, stdout: '' });
  });

  afterEach(async () => {
    const actual = await vi.importActual<typeof import('fs')>('fs');
    vi.mocked(lstatSync).mockImplementation(actual.lstatSync);
    process.umask(previousUmask);
    vi.unstubAllEnvs();
    rmSync(root, { recursive: true, force: true });
  });

  /** A temp dir candidate that is refused, so no test falls back to the runner's own. */
  function stubSharedTmpDir() {
    const sharedTmp = join(root, 'shared-tmp');
    mkdirSync(sharedTmp, { recursive: true });
    chmodSync(sharedTmp, 0o777);
    stubTmpDir(sharedTmp);
    return sharedTmp;
  }

  function stubTmpDir(dir: string) {
    vi.stubEnv('TMPDIR', dir);
    vi.stubEnv('TMP', dir);
    vi.stubEnv('TEMP', dir);
  }

  /** A home whose ~/.nx cannot be a directory. */
  function stubUnusableHome() {
    const home = join(root, 'home');
    mkdirSync(home);
    writeFileSync(join(home, '.nx'), '');
    vi.stubEnv('HOME', home);
    vi.stubEnv('USERPROFILE', home);
  }

  /**
   * Reports the runner's directories above `root` as root-owned 0755, so the
   * ancestor checks depend only on what each test builds inside `root`.
   */
  async function treatDirsAboveRootAsSystemDirs() {
    const actual = await vi.importActual<typeof import('fs')>('fs');
    vi.mocked(lstatSync).mockImplementation(((p: any, o?: any) => {
      const stats = actual.lstatSync(p, o);
      const belowPath = relative(String(p), root);
      if (!stats || belowPath === '' || belowPath.startsWith('..')) {
        return stats;
      }
      return Object.assign(Object.create(Object.getPrototypeOf(stats)), {
        ...stats,
        uid: 0,
        mode: (stats.mode & ~0o7777) | 0o755,
      });
    }) as any);
  }

  it('installs outside the shared temp dir, whose ancestors package managers read', async () => {
    const sharedTmp = join(root, 'shared-tmp');
    const home = join(root, 'home');
    mkdirSync(sharedTmp, { mode: 0o777 });
    mkdirSync(home);
    writeFileSync(join(sharedTmp, '.npmrc'), 'git=./planted\n');
    writeFileSync(join(sharedTmp, '.yarnrc'), 'yarn-path "./planted"\n');
    writeFileSync(join(sharedTmp, 'pnpm-workspace.yaml'), 'packages: []\n');
    mkdirSync(join(sharedTmp, 'node_modules'));
    vi.stubEnv('TMPDIR', sharedTmp);
    vi.stubEnv('TMP', sharedTmp);
    vi.stubEnv('TEMP', sharedTmp);
    vi.stubEnv('HOME', home);
    vi.stubEnv('USERPROFILE', home);
    const { createSandbox } = await import('./create-sandbox');

    const dir = realpathSync(await createSandbox('npm'));

    expect(dir.startsWith(sharedTmp)).toBe(false);
    expect(dirname(dir)).toEqual(join(home, '.nx', 'tmp'));
    expect(mockExecAndWait).toHaveBeenCalledWith(expect.any(String), dir);
    if (process.platform !== 'win32') {
      expect(statSync(join(home, '.nx')).mode & 0o022).toBe(0);
      expect(statSync(dir).mode & 0o077).toBe(0);
    }
  });

  it.skipIf(process.platform === 'win32')(
    'refuses to install when the home directory is the shared temp dir',
    async () => {
      stubSharedTmpDir();
      vi.stubEnv('HOME', '/tmp');
      const { createSandbox } = await import('./create-sandbox');

      await expect(createSandbox('npm')).rejects.toMatchObject({
        code: 'SANDBOX_FAILED',
        message: expect.stringContaining(
          'there is no home directory separate from the shared temp directory'
        ),
      });
      expect(mockExecAndWait).not.toHaveBeenCalled();
    }
  );

  it.skipIf(process.platform === 'win32')(
    'refuses to install when the home directory is under the shared temp dir',
    async () => {
      stubSharedTmpDir();
      vi.stubEnv('HOME', '/tmp/cnw-sandbox-spec-absent/home');
      const { createSandbox } = await import('./create-sandbox');

      await expect(createSandbox('npm')).rejects.toMatchObject({
        code: 'SANDBOX_FAILED',
        message: expect.stringContaining(
          'there is no home directory separate from the shared temp directory'
        ),
      });
      expect(mockExecAndWait).not.toHaveBeenCalled();
    }
  );

  it.skipIf(process.platform === 'win32')(
    'refuses to install when ~/.nx is not a private directory',
    async () => {
      const home = join(root, 'home');
      const elsewhere = join(root, 'elsewhere');
      mkdirSync(home);
      mkdirSync(elsewhere);
      symlinkSync(elsewhere, join(home, '.nx'), 'dir');
      stubSharedTmpDir();
      vi.stubEnv('HOME', home);
      const { createSandbox } = await import('./create-sandbox');

      await expect(createSandbox('npm')).rejects.toMatchObject({
        code: 'SANDBOX_FAILED',
      });
      expect(readdirSync(elsewhere)).toEqual([]);
      expect(mockExecAndWait).not.toHaveBeenCalled();
    }
  );

  it.skipIf(process.platform === 'win32')(
    'falls back to a private temp dir when ~/.nx is unusable',
    async () => {
      const privateTmp = join(root, 'private-tmp');
      mkdirSync(privateTmp, { mode: 0o700 });
      stubTmpDir(privateTmp);
      stubUnusableHome();
      await treatDirsAboveRootAsSystemDirs();
      const { createSandbox } = await import('./create-sandbox');

      const dir = await createSandbox('npm');

      expect(dirname(dir)).toEqual(join(privateTmp, 'nx-installs'));
      expect(statSync(dirname(dir)).mode & 0o077).toBe(0);
      expect(statSync(dir).mode & 0o077).toBe(0);
      expect(mockExecAndWait).toHaveBeenCalledWith(expect.any(String), dir);
    }
  );

  it.skipIf(process.platform === 'win32')(
    'removes stale install dirs left in the temp dir fallback',
    async () => {
      const privateTmp = join(root, 'private-tmp');
      const installRoot = join(privateTmp, 'nx-installs');
      mkdirSync(installRoot, { recursive: true, mode: 0o700 });
      chmodSync(privateTmp, 0o700);
      const old = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
      const stale = join(installRoot, 'tmp-stale');
      mkdirSync(stale);
      utimesSync(stale, old, old);
      stubTmpDir(privateTmp);
      stubUnusableHome();
      await treatDirsAboveRootAsSystemDirs();
      const { createSandbox } = await import('./create-sandbox');

      await createSandbox('npm');

      expect(existsSync(stale)).toBe(false);
    }
  );

  it.skipIf(process.platform === 'win32').each([
    [
      'a group-writable parent',
      0o775,
      0o700,
      /parent is writable by other users \(mode 0775\)/,
    ],
    [
      'a world-writable parent',
      0o777,
      0o700,
      /parent is writable by other users \(mode 0777\)/,
    ],
    [
      'a sticky world-writable parent',
      0o1777,
      0o700,
      /parent is writable by other users \(mode 1777\)/,
    ],
    [
      'a group-writable temp dir',
      0o755,
      0o770,
      /private-tmp is writable by other users \(mode 0770\)/,
    ],
  ])(
    'refuses a temp dir with %s and names both refusals',
    async (_label, parentMode, tmpMode, reason) => {
      const parent = join(root, 'parent');
      const privateTmp = join(parent, 'private-tmp');
      mkdirSync(privateTmp, { recursive: true });
      chmodSync(privateTmp, tmpMode);
      chmodSync(parent, parentMode);
      stubTmpDir(privateTmp);
      stubUnusableHome();
      await treatDirsAboveRootAsSystemDirs();
      const { createSandbox } = await import('./create-sandbox');

      const error = await createSandbox('npm').catch((e: Error) => e);

      expect(error).toMatchObject({ code: 'SANDBOX_FAILED' });
      expect((error as Error).message).toMatch(
        /home[/\\]\.nx is not a directory owned by you/
      );
      expect((error as Error).message).toMatch(reason);
      expect(readdirSync(privateTmp)).toEqual([]);
      expect(mockExecAndWait).not.toHaveBeenCalled();
    }
  );

  it.skipIf(process.platform === 'win32')(
    'refuses a temp dir that is a symlink',
    async () => {
      const realTmp = join(root, 'real-tmp');
      const linkedTmp = join(root, 'linked-tmp');
      mkdirSync(realTmp, { mode: 0o700 });
      symlinkSync(realTmp, linkedTmp, 'dir');
      stubTmpDir(linkedTmp);
      stubUnusableHome();
      await treatDirsAboveRootAsSystemDirs();
      const { createSandbox } = await import('./create-sandbox');

      await expect(createSandbox('npm')).rejects.toMatchObject({
        code: 'SANDBOX_FAILED',
        message: expect.stringMatching(/linked-tmp is a symlink/),
      });
      expect(readdirSync(realTmp)).toEqual([]);
    }
  );

  it('removes stale install dirs left in the private root, keeping fresh ones and symlink targets', async () => {
    const home = join(root, 'home');
    const installRoot = join(home, '.nx', 'tmp');
    mkdirSync(installRoot, { recursive: true, mode: 0o700 });
    const old = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    const stale = join(installRoot, 'tmp-stale');
    mkdirSync(join(stale, 'node_modules'), { recursive: true });
    utimesSync(stale, old, old);
    const fresh = join(installRoot, 'tmp-fresh');
    mkdirSync(fresh);
    const outside = join(root, 'outside');
    mkdirSync(outside);
    writeFileSync(join(outside, 'keep'), '');
    utimesSync(outside, old, old);
    const link = join(installRoot, 'tmp-link');
    symlinkSync(outside, link, 'dir');
    lutimesSync(link, old, old);
    vi.stubEnv('HOME', home);
    vi.stubEnv('USERPROFILE', home);
    const { createSandbox } = await import('./create-sandbox');

    await createSandbox('npm');

    expect(existsSync(stale)).toBe(false);
    expect(existsSync(fresh)).toBe(true);
    expect(existsSync(link)).toBe(true);
    expect(existsSync(join(outside, 'keep'))).toBe(true);
  });
});
