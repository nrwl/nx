const mockExecAndWait = vi.fn();
vi.mock('./utils/child-process-utils', () => ({
  execAndWait: (...args: unknown[]) => mockExecAndWait(...args),
}));

import {
  existsSync,
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
import { dirname, join } from 'path';

describe('createSandbox', () => {
  let root: string;

  beforeEach(() => {
    // Outside the shared temp dir, which is refused as a home.
    const parent = join(process.cwd(), 'tmp');
    mkdirSync(parent, { recursive: true });
    root = realpathSync(mkdtempSync(join(parent, 'cnw-sandbox-')));
    mockExecAndWait.mockReset().mockResolvedValue({ code: 0, stdout: '' });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    rmSync(root, { recursive: true, force: true });
  });

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
      vi.stubEnv('HOME', '/tmp');
      const { createSandbox } = await import('./create-sandbox');

      await expect(createSandbox('npm')).rejects.toMatchObject({
        code: 'SANDBOX_FAILED',
        message: expect.stringMatching(
          /^Nx cannot install packages without a private ~\/\.nx directory: there is no home directory separate from the shared temp directory\./
        ),
      });
      expect(mockExecAndWait).not.toHaveBeenCalled();
    }
  );

  it.skipIf(process.platform === 'win32')(
    'refuses to install when the home directory is under the shared temp dir',
    async () => {
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
      vi.stubEnv('HOME', home);
      const { createSandbox } = await import('./create-sandbox');

      await expect(createSandbox('npm')).rejects.toMatchObject({
        code: 'SANDBOX_FAILED',
      });
      expect(readdirSync(elsewhere)).toEqual([]);
      expect(mockExecAndWait).not.toHaveBeenCalled();
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
