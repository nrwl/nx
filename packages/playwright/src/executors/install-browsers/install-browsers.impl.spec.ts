import { logger, type ExecutorContext } from '@nx/devkit';
import { FileLock, isCI, runCommandsExecutor } from '@nx/devkit/internal';
import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import installBrowsersExecutor from './install-browsers.impl';

// Stands in for the host's /tmp, which the Linux lock uses whatever TMPDIR says.
const hostTmp = vi.hoisted(() => ({ folder: '' }));

vi.mock('@nx/devkit/internal', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@nx/devkit/internal')>();
  const { basename, dirname, join } = await import('node:path');
  function FileLock(lockFilePath: string) {
    return new actual.FileLock(
      dirname(lockFilePath) === join('/tmp')
        ? join(hostTmp.folder, basename(lockFilePath))
        : lockFilePath
    );
  }
  return {
    ...actual,
    FileLock: FileLock as unknown as typeof actual.FileLock,
    isCI: vi.fn(),
    runCommandsExecutor: vi.fn(),
  };
});
vi.mock('node:child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:child_process')>();
  return { ...actual, spawnSync: vi.fn(actual.spawnSync) };
});

const PLAYWRIGHT_ENV = [
  'PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD',
  'npm_config_playwright_skip_browser_download',
  'npm_package_config_playwright_skip_browser_download',
  'PW_TEST_CONNECT_WS_ENDPOINT',
  'PLAYWRIGHT_BROWSERS_PATH',
  'npm_config_playwright_browsers_path',
  'npm_package_config_playwright_browsers_path',
  'INIT_CWD',
  // os.tmpdir() reads TMPDIR on POSIX and TEMP or TMP on Windows.
  'TMPDIR',
  'TEMP',
  'TMP',
];

describe('installBrowsersExecutor', () => {
  let root: string;
  let context: ExecutorContext;
  let savedEnv: Record<string, string | undefined>;
  const platform = Object.getOwnPropertyDescriptor(process, 'platform');
  const getuid = Object.getOwnPropertyDescriptor(process, 'getuid');

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'nx-playwright-install-'));
    context = {
      root,
      cwd: root,
      isVerbose: false,
      projectName: 'app-e2e',
      projectsConfigurations: {
        version: 2,
        projects: { 'app-e2e': { root: 'apps/app-e2e' } },
      },
    } as ExecutorContext;
    writePlaywrightVersion('1.64.1');

    savedEnv = {};
    for (const name of PLAYWRIGHT_ENV) {
      savedEnv[name] = process.env[name];
      delete process.env[name];
    }
    process.env.PLAYWRIGHT_BROWSERS_PATH = join(root, 'browsers');
    const lockFolder = join(root, 'tmp');
    mkdirSync(lockFolder);
    process.env.TMPDIR = process.env.TEMP = process.env.TMP = lockFolder;
    hostTmp.folder = join(root, 'host-tmp');
    mkdirSync(hostTmp.folder);

    setPlatform('darwin');
    vi.mocked(isCI).mockReturnValue(false);
    vi.mocked(runCommandsExecutor).mockResolvedValue({
      success: true,
      terminalOutput: '',
    });
    vi.spyOn(logger, 'info').mockImplementation(() => {});
    vi.spyOn(logger, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    Object.defineProperty(process, 'platform', platform);
    if (getuid) {
      Object.defineProperty(process, 'getuid', getuid);
    } else {
      delete process.getuid;
    }
    for (const [name, value] of Object.entries(savedEnv)) {
      if (value === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = value;
      }
    }
    vi.mocked(runCommandsExecutor).mockReset();
    vi.mocked(spawnSync).mockClear();
    vi.restoreAllMocks();
    rmSync(root, { recursive: true, force: true });
  });

  it.each([
    [['chromium', 'firefox'], 'playwright install chromium firefox'],
    [undefined, 'playwright install'],
  ])(
    'installs %j from the project folder',
    async (browsers, expectedCommand) => {
      const result = await installBrowsersExecutor({ browsers }, context);

      expect(result).toEqual({ success: true });
      expect(logger.error).not.toHaveBeenCalled();
      expect(runCommandsExecutor).toHaveBeenCalledTimes(1);
      expect(runCommandsExecutor).toHaveBeenCalledWith(
        expect.objectContaining({
          command: expectedCommand,
          cwd: 'apps/app-e2e',
        }),
        context
      );
    }
  );

  it('fails when the install fails', async () => {
    vi.mocked(runCommandsExecutor).mockResolvedValue({
      success: false,
      terminalOutput: '',
    });

    const result = await installBrowsersExecutor(
      { browsers: ['chromium'] },
      context
    );

    expect(result).toEqual({ success: false });
    // The failure names both opt-outs.
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1')
    );
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('"installBrowsers": false')
    );
  });

  it.each([
    ['PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD', '1'],
    ['npm_config_playwright_skip_browser_download', 'true'],
  ])('skips the install when %s is %s', async (name, value) => {
    process.env[name] = value;

    const result = await installBrowsersExecutor(
      { browsers: ['chromium'] },
      context
    );

    expect(result).toEqual({ success: true });
    expect(runCommandsExecutor).not.toHaveBeenCalled();
  });

  it.each([
    ['PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD', '0'],
    ['PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD', 'false'],
    // The config can set or clear it, so the graph, not the install, decides
    // whether the tests need a local browser.
    ['PW_TEST_CONNECT_WS_ENDPOINT', 'ws://localhost:3000'],
  ])('installs when %s is %s', async (name, value) => {
    process.env[name] = value;

    await installBrowsersExecutor({ browsers: ['chromium'] }, context);

    expect(commands()).toEqual(['playwright install chromium']);
  });

  // Root can write to any folder, and Node reports every folder as writable on
  // Windows, so the permission check passes regardless.
  it.skipIf(process.platform === 'win32' || process.getuid?.() === 0)(
    'skips the install when the browsers folder is not writable',
    async () => {
      const readOnly = join(root, 'read-only');
      mkdirSync(readOnly);
      chmodSync(readOnly, 0o555);
      process.env.PLAYWRIGHT_BROWSERS_PATH = join(readOnly, 'ms-playwright');

      try {
        const result = await installBrowsersExecutor(
          { browsers: ['chromium'] },
          context
        );

        expect(result).toEqual({ success: true });
        expect(runCommandsExecutor).not.toHaveBeenCalled();
      } finally {
        chmodSync(readOnly, 0o755);
      }
    }
  );

  it.each<[NodeJS.Platform, () => string]>([
    ['darwin', () => tmpdir()],
    // The other install's temp folder differs from this one's.
    ['linux', () => '/tmp'],
  ])(
    'waits for another install that holds the lock on %s',
    async (platform, lockFolder) => {
      setPlatform(platform);
      const otherInstall = new FileLock(
        join(lockFolder(), 'nx-playwright-install.lock')
      );
      otherInstall.lock();

      const result = installBrowsersExecutor(
        { browsers: ['chromium'] },
        context
      );
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(runCommandsExecutor).not.toHaveBeenCalled();

      otherInstall.unlock();
      expect(await result).toEqual({ success: true });
      expect(commands()).toEqual(['playwright install chromium']);
    }
  );

  it('installs without the lock when the lock file cannot be opened', async () => {
    mkdirSync(join(tmpdir(), 'nx-playwright-install.lock'));
    vi.spyOn(logger, 'warn').mockImplementation(() => {});

    const result = await installBrowsersExecutor(
      { browsers: ['chromium'] },
      context
    );

    expect(result).toEqual({ success: true });
    expect(commands()).toEqual(['playwright install chromium']);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('without waiting for other installs')
    );
  });

  describe('system packages', () => {
    it.each([
      {
        name: 'checks them on Linux in CI',
        os: 'linux',
        ci: true,
        withDeps: undefined,
        checks: true,
      },
      {
        name: 'skips them on Linux outside CI',
        os: 'linux',
        ci: false,
        withDeps: undefined,
        checks: false,
      },
      {
        name: 'skips them when withDeps is false',
        os: 'linux',
        ci: true,
        withDeps: false,
        checks: false,
      },
      {
        name: 'checks them when withDeps is true outside CI',
        os: 'linux',
        ci: false,
        withDeps: true,
        checks: true,
      },
      {
        name: 'skips them on macOS, where Playwright has none',
        os: 'darwin',
        ci: true,
        withDeps: true,
        checks: false,
      },
    ] as const)('$name', async ({ os, ci, withDeps, checks }) => {
      setPlatform(os);
      vi.mocked(isCI).mockReturnValue(ci);
      mockHostCommands({ aptGet: true });

      await installBrowsersExecutor(
        { browsers: ['chromium'], withDeps },
        context
      );

      expect(commands()).toEqual([
        ...(checks ? ['playwright install-deps --dry-run chromium'] : []),
        'playwright install chromium',
      ]);
    });

    it('installs them when the dry run finds missing packages', async () => {
      setPlatform('linux');
      mockHostCommands({ aptGet: true });
      vi.mocked(runCommandsExecutor).mockImplementation(async (options) => ({
        success: !options.command.includes('--dry-run'),
        terminalOutput: '',
      }));

      const result = await installBrowsersExecutor(
        { browsers: ['chromium'], withDeps: true },
        context
      );

      expect(result).toEqual({ success: true });
      expect(logger.error).not.toHaveBeenCalled();
      expect(commands()).toEqual([
        'playwright install-deps --dry-run chromium',
        'playwright install-deps chromium',
        'playwright install chromium',
      ]);
    });

    // Before 1.60.0 the dry run exits 0 even when packages are missing, so
    // root access and `withDeps` decide whether apt runs.
    it.each([
      {
        name: 'installs them as root before Playwright 1.60.0',
        version: '1.59.1',
        uid: 0,
        passwordlessSudo: false,
        withDeps: undefined,
        expected: ['playwright install-deps chromium'],
      },
      {
        name: 'installs them through passwordless sudo before Playwright 1.60.0',
        version: '1.59.1',
        uid: 1000,
        passwordlessSudo: true,
        withDeps: undefined,
        expected: ['playwright install-deps chromium'],
      },
      {
        name: 'skips them without root or passwordless sudo before Playwright 1.60.0',
        version: '1.59.1',
        uid: 1000,
        passwordlessSudo: false,
        withDeps: undefined,
        expected: [],
      },
      {
        name: 'skips them without root or passwordless sudo when the Playwright version is unknown',
        version: null,
        uid: 1000,
        passwordlessSudo: false,
        withDeps: undefined,
        expected: [],
      },
      {
        name: 'installs them without root or passwordless sudo when withDeps is true',
        version: '1.59.1',
        uid: 1000,
        passwordlessSudo: false,
        withDeps: true,
        expected: ['playwright install-deps chromium'],
      },
      {
        name: 'installs them without root or passwordless sudo from Playwright 1.60.0 when the dry run finds missing packages',
        version: '1.64.1',
        uid: 1000,
        passwordlessSudo: false,
        withDeps: undefined,
        expected: [
          'playwright install-deps --dry-run chromium',
          'playwright install-deps chromium',
        ],
      },
    ] as const)(
      '$name',
      async ({ version, uid, passwordlessSudo, withDeps, expected }) => {
        setPlatform('linux');
        vi.mocked(isCI).mockReturnValue(true);
        Object.defineProperty(process, 'getuid', {
          value: () => uid,
          configurable: true,
        });
        mockHostCommands({ aptGet: true, passwordlessSudo });
        if (version === null) {
          rmSync(join(root, 'node_modules'), { recursive: true });
        } else {
          writePlaywrightVersion(version);
        }
        vi.mocked(runCommandsExecutor).mockImplementation(async (options) => ({
          success: !options.command.includes('--dry-run'),
          terminalOutput: '',
        }));

        const result = await installBrowsersExecutor(
          { browsers: ['chromium'], withDeps },
          context
        );

        expect(result).toEqual({ success: true });
        expect(commands()).toEqual([
          ...expected,
          'playwright install chromium',
        ]);
      }
    );

    it('installs them without a dry run on Windows', async () => {
      setPlatform('win32');

      await installBrowsersExecutor(
        { browsers: ['chromium'], withDeps: true },
        context
      );

      expect(commands()).toEqual([
        'playwright install-deps chromium',
        'playwright install chromium',
      ]);
    });

    it('skips them when apt-get is missing', async () => {
      setPlatform('linux');
      mockHostCommands({ aptGet: false });

      await installBrowsersExecutor(
        { browsers: ['chromium'], withDeps: true },
        context
      );

      expect(commands()).toEqual(['playwright install chromium']);
    });

    it('fails without installing the browsers when the system packages fail to install', async () => {
      setPlatform('linux');
      mockHostCommands({ aptGet: true });
      writePlaywrightVersion('1.59.1');
      vi.mocked(runCommandsExecutor).mockResolvedValue({
        success: false,
        terminalOutput: '',
      });

      const result = await installBrowsersExecutor(
        { browsers: ['chromium'], withDeps: true },
        context
      );

      expect(result).toEqual({ success: false });
      expect(commands()).toEqual(['playwright install-deps chromium']);
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('"withDeps": false')
      );
    });
  });

  function writePlaywrightVersion(version: string): void {
    const packageFolder = join(root, 'node_modules', '@playwright', 'test');
    mkdirSync(packageFolder, { recursive: true });
    writeFileSync(
      join(packageFolder, 'package.json'),
      JSON.stringify({ name: '@playwright/test', version })
    );
  }
});

function setPlatform(value: NodeJS.Platform): void {
  Object.defineProperty(process, 'platform', { value });
}

function mockHostCommands({
  aptGet,
  passwordlessSudo = false,
}: {
  aptGet: boolean;
  passwordlessSudo?: boolean;
}): void {
  vi.mocked(spawnSync).mockImplementation(((command: string) => {
    if (command === 'apt-get') {
      return aptGet
        ? { status: 0 }
        : { error: new Error('spawnSync apt-get ENOENT') };
    }
    if (command === 'sudo') {
      // `sudo -n` exits 1 when it would ask for a password.
      return { status: passwordlessSudo ? 0 : 1 };
    }
    throw new Error(`Unexpected command: ${command}`);
  }) as unknown as typeof spawnSync);
}

function commands(): string[] {
  return vi
    .mocked(runCommandsExecutor)
    .mock.calls.map(([options]) => options.command);
}
