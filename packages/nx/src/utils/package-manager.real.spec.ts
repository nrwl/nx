import {
  chmodSync,
  existsSync,
  lstatSync,
  lutimesSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  statSync,
  symlinkSync,
  utimesSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import {
  detectPackageManager,
  getPackageManagerVersion,
} from './package-manager';
import { setWorkspaceRoot, workspaceRoot } from './workspace-root';

vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs');
  return { ...actual, lstatSync: vi.fn(actual.lstatSync) };
});

const { packageManager } = JSON.parse(
  readFileSync(join(__dirname, '../../../../package.json'), 'utf-8')
) as { packageManager: string };

it('detects the pnpm version without creating temporary workspace files', () => {
  const directory = mkdtempSync(join(tmpdir(), 'nx-pnpm-version-'));
  const workspace = join(directory, 'workspace');

  try {
    mkdirSync(workspace);
    writeFileSync(
      join(directory, 'package.json'),
      JSON.stringify({ packageManager })
    );
    writeFileSync(join(workspace, 'package.json'), '{}');
    vi.stubEnv('COREPACK_ENABLE_PROJECT_SPEC', '1');
    vi.stubEnv('COREPACK_ENABLE_NETWORK', '0');
    vi.stubEnv('COREPACK_ENABLE_AUTO_PIN', '0');
    vi.stubEnv('XDG_CONFIG_HOME', join(directory, 'config'));
    vi.stubEnv('PNPM_HOME', join(directory, 'pnpm'));
    vi.stubEnv('PNPM_CONFIG_STORE_DIR', undefined);
    vi.stubEnv('pnpm_config_store_dir', undefined);

    // Creating and deleting a temporary file still changes the directory mtime.
    utimesSync(workspace, new Date('2000-01-01'), new Date('2000-01-01'));
    const modifiedBefore = statSync(workspace).mtimeMs;

    expect(getPackageManagerVersion('pnpm', workspace)).toBe(
      packageManager.slice('pnpm@'.length).split('+')[0]
    );
    expect(statSync(workspace).mtimeMs).toBe(modifiedBefore);
  } finally {
    vi.unstubAllEnvs();
    rmSync(directory, { recursive: true, force: true });
  }
});

it.each([
  {
    scenario: 'a nested cwd in a pnpm workspace',
    mode: 'cwd',
    lockfile: 'pnpm-lock.yaml',
    invokedManager: 'npm',
    expected: 'pnpm',
  },
  {
    scenario: 'a nested cwd in an npm workspace',
    mode: 'cwd',
    lockfile: 'package-lock.json',
    invokedManager: 'pnpm',
    expected: 'npm',
  },
  {
    scenario: 'a nested cwd in a Yarn workspace',
    mode: 'cwd',
    lockfile: 'yarn.lock',
    invokedManager: 'pnpm',
    expected: 'yarn',
  },
  {
    scenario: 'a relative project directory',
    mode: 'relative',
    lockfile: 'pnpm-lock.yaml',
    invokedManager: 'npm',
    expected: 'pnpm',
  },
  {
    scenario: 'an absolute project directory',
    mode: 'absolute',
    lockfile: 'pnpm-lock.yaml',
    invokedManager: 'npm',
    expected: 'pnpm',
  },
  {
    scenario: 'a project with its own lockfile',
    mode: 'local-lockfile',
    lockfile: 'pnpm-lock.yaml',
    invokedManager: 'npm',
    expected: 'yarn',
  },
  {
    scenario: 'a separate nested workspace',
    mode: 'nested',
    lockfile: 'pnpm-lock.yaml',
    invokedManager: 'npm',
    expected: 'npm',
  },
  {
    scenario: 'a project in a separate nested workspace',
    mode: 'nested-project',
    lockfile: 'pnpm-lock.yaml',
    invokedManager: 'npm',
    expected: 'npm',
  },
  {
    scenario: 'an external directory sharing the workspace name prefix',
    mode: 'external',
    lockfile: 'pnpm-lock.yaml',
    invokedManager: 'npm',
    expected: 'npm',
  },
])(
  'detects $expected for $scenario',
  ({ mode, lockfile, invokedManager, expected }) => {
    const temporaryDirectory = realpathSync(
      mkdtempSync(join(tmpdir(), 'nx-package-manager-'))
    );
    const directory = join(temporaryDirectory, 'workspace');
    const projectDirectory = join(directory, 'packages', 'app');
    const nestedWorkspace = join(directory, 'nested');
    const originalDirectory = process.cwd();
    const originalWorkspaceRoot = workspaceRoot;

    try {
      mkdirSync(projectDirectory, { recursive: true });
      mkdirSync(join(directory, 'packages', 'nx'));
      writeFileSync(join(directory, 'nx.json'), '{}');
      writeFileSync(join(directory, lockfile), '');
      vi.stubEnv('npm_config_user_agent', `${invokedManager}/1.0.0`);
      setWorkspaceRoot(directory);
      process.chdir(mode === 'cwd' ? projectDirectory : directory);

      let detectionDirectory: string | undefined;
      switch (mode) {
        case 'relative':
          detectionDirectory = join('packages', 'app');
          break;
        case 'absolute':
          detectionDirectory = projectDirectory;
          break;
        case 'local-lockfile':
          writeFileSync(join(projectDirectory, 'yarn.lock'), '');
          detectionDirectory = projectDirectory;
          break;
        case 'nested':
        case 'nested-project':
          mkdirSync(join(nestedWorkspace, 'packages', 'app'), {
            recursive: true,
          });
          writeFileSync(join(nestedWorkspace, 'nx.json'), '{}');
          detectionDirectory =
            mode === 'nested'
              ? nestedWorkspace
              : join(nestedWorkspace, 'packages', 'app');
          break;
        case 'external':
          detectionDirectory = join(temporaryDirectory, 'workspace-other');
          mkdirSync(detectionDirectory);
          break;
      }

      expect(detectPackageManager(detectionDirectory)).toBe(expected);
    } finally {
      process.chdir(originalDirectory);
      setWorkspaceRoot(originalWorkspaceRoot);
      vi.unstubAllEnvs();
      rmSync(temporaryDirectory, { recursive: true, force: true });
    }
  }
);

describe('createTempNpmDirectory', () => {
  let root: string;

  let previousUmask: number;

  beforeEach(() => {
    previousUmask = process.umask(0o022);
    // Outside the shared temp dir, which is refused as a home.
    const parent = join(process.cwd(), 'tmp');
    mkdirSync(parent, { recursive: true });
    root = realpathSync(mkdtempSync(join(parent, 'nx-temp-install-')));
  });

  afterEach(async () => {
    const actual = await vi.importActual<typeof import('fs')>('fs');
    vi.mocked(lstatSync).mockImplementation(actual.lstatSync);
    process.umask(previousUmask);
    vi.unstubAllEnvs();
    vi.resetModules();
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

  it('keeps the install out of the shared temp dir, whose ancestors package managers read', async () => {
    const sharedTmp = join(root, 'shared-tmp');
    const home = join(root, 'home');
    mkdirSync(sharedTmp, { mode: 0o777 });
    mkdirSync(home);
    writeFileSync(join(sharedTmp, '.npmrc'), 'git=./planted\n');
    writeFileSync(
      join(sharedTmp, 'package.json'),
      JSON.stringify({ workspaces: ['tmp-*'] })
    );
    mkdirSync(join(sharedTmp, 'node_modules'));
    vi.stubEnv('TMPDIR', sharedTmp);
    vi.stubEnv('TMP', sharedTmp);
    vi.stubEnv('TEMP', sharedTmp);
    vi.stubEnv('HOME', home);
    vi.stubEnv('USERPROFILE', home);
    vi.resetModules();
    const { createTempNpmDirectory } = await import('./package-manager');

    const { dir, cleanup } = createTempNpmDirectory(true);

    try {
      expect(realpathSync(dir).startsWith(sharedTmp)).toBe(false);
      expect(dirname(realpathSync(dir))).toEqual(join(home, '.nx', 'tmp'));
      if (process.platform !== 'win32') {
        expect(statSync(join(home, '.nx')).mode & 0o077).toBe(0);
        expect(statSync(dir).mode & 0o077).toBe(0);
      }
    } finally {
      await cleanup();
    }
  });

  it.skipIf(process.platform === 'win32')(
    'refuses to install when the home directory is the shared temp dir',
    async () => {
      const sharedTmp = stubSharedTmpDir();
      vi.stubEnv('HOME', '/tmp');
      vi.resetModules();
      const { createTempNpmDirectory } = await import('./package-manager');

      expect(() => createTempNpmDirectory(true)).toThrow(
        'there is no home directory separate from the shared temp directory'
      );
      expect(readdirSync(sharedTmp)).toEqual([]);
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
      vi.resetModules();
      const { createTempNpmDirectory } = await import('./package-manager');

      expect(() => createTempNpmDirectory(true)).toThrow(/\.nx is a symlink/);
      expect(readdirSync(elsewhere)).toEqual([]);
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
      vi.resetModules();
      const { createTempNpmDirectory } = await import('./package-manager');

      const { dir, cleanup } = createTempNpmDirectory(true);

      try {
        expect(dirname(dir)).toEqual(join(privateTmp, 'nx-installs'));
        expect(statSync(dirname(dir)).mode & 0o077).toBe(0);
        expect(statSync(dir).mode & 0o077).toBe(0);
      } finally {
        await cleanup();
      }
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
      vi.resetModules();
      const { createTempNpmDirectory } = await import('./package-manager');

      const { cleanup } = createTempNpmDirectory(true);
      await cleanup();

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
      vi.resetModules();
      const { createTempNpmDirectory } = await import('./package-manager');

      let error: Error | undefined;
      try {
        createTempNpmDirectory(true);
      } catch (e) {
        error = e as Error;
      }

      expect(error?.message).toMatch(
        /home[/\\]\.nx exists and is not a directory/
      );
      expect(error?.message).toMatch(reason);
      expect(readdirSync(privateTmp)).toEqual([]);
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
      vi.resetModules();
      const { createTempNpmDirectory } = await import('./package-manager');

      expect(() => createTempNpmDirectory(true)).toThrow(
        /linked-tmp is a symlink/
      );
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
    vi.resetModules();
    const { createTempNpmDirectory } = await import('./package-manager');

    const { cleanup } = createTempNpmDirectory(true);
    await cleanup();

    expect(existsSync(stale)).toBe(false);
    expect(existsSync(fresh)).toBe(true);
    expect(existsSync(link)).toBe(true);
    expect(existsSync(join(outside, 'keep'))).toBe(true);
  });
});
