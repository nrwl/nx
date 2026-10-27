import {
  existsSync,
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
import { dirname, join } from 'node:path';
import {
  detectPackageManager,
  getPackageManagerVersion,
} from './package-manager';
import { setWorkspaceRoot, workspaceRoot } from './workspace-root';

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

  beforeEach(() => {
    // Outside the shared temp dir, which is refused as a home.
    const parent = join(process.cwd(), 'tmp');
    mkdirSync(parent, { recursive: true });
    root = realpathSync(mkdtempSync(join(parent, 'nx-temp-install-')));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
    rmSync(root, { recursive: true, force: true });
  });

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
      vi.stubEnv('HOME', '/tmp');
      vi.resetModules();
      const { createTempNpmDirectory } = await import('./package-manager');

      expect(() => createTempNpmDirectory(true)).toThrow(
        'Nx cannot install packages without a private ~/.nx directory: there is no home directory separate from the shared temp directory.'
      );
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
      vi.resetModules();
      const { createTempNpmDirectory } = await import('./package-manager');

      expect(() => createTempNpmDirectory(true)).toThrow(
        /^Nx cannot install packages without a private ~\/\.nx directory: .*symlink/
      );
      expect(readdirSync(elsewhere)).toEqual([]);
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
