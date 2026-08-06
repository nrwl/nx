// Wiring tests for the three version-skew-guard call sites in migrate.ts;
// the guards' own behavior lives in version-skew-guard.spec.ts. Kept in its
// own file so the module mocks below don't leak into the other migrate
// specs.

const mockResolveRunTarget = jest.fn();
const mockAssertWorkspaceNx = jest.fn();
jest.mock('./version-skew-guard', () => ({
  ...jest.requireActual('./version-skew-guard'),
  resolveNewMigrateFlagsRunTarget: (...args: unknown[]) =>
    mockResolveRunTarget(...args),
  assertWorkspaceNxSupportsNewMigrateFlags: (...args: unknown[]) =>
    mockAssertWorkspaceNx(...args),
}));

const mockEnsurePackageHasProvenance = jest.fn();
jest.mock('../../utils/provenance', () => ({
  ...jest.requireActual('../../utils/provenance'),
  ensurePackageHasProvenance: (...args: unknown[]) =>
    mockEnsurePackageHasProvenance(...args),
}));

// Both spawn helpers are mocked: the hand-off calls runNxArgvSync, and
// connect-to-nx-cloud, which migrate.ts imports, calls runNxSync.
const mockRunNxSync = jest.fn();
const mockRunNxArgvSync = jest.fn();
jest.mock('../../utils/child-process', () => ({
  ...jest.requireActual('../../utils/child-process'),
  runNxSync: (...args: unknown[]) => mockRunNxSync(...args),
  runNxArgvSync: (...args: unknown[]) => mockRunNxArgvSync(...args),
}));

// The temp-CLI hand-off installs nx for real; stubbing the dir it installs
// into and the commands it runs lets a test shape that installation.
const mockTmpDirSync = jest.fn();
jest.mock('tmp', () => ({
  ...jest.requireActual('tmp'),
  dirSync: (...args: unknown[]) => mockTmpDirSync(...args),
}));

const mockExecSync = jest.fn();
jest.mock('child_process', () => ({
  ...jest.requireActual('child_process'),
  execSync: (...args: unknown[]) => mockExecSync(...args),
}));

const mockRunInstall = jest.fn();
jest.mock('./execute-migration', () => ({
  ...jest.requireActual('./execute-migration'),
  runInstall: (...args: unknown[]) => mockRunInstall(...args),
}));

const mockResolvePackageVersion = jest.fn();
jest.mock('./resolve-package-version', () => ({
  ...jest.requireActual('./resolve-package-version'),
  resolvePackageVersionRespectingMinReleaseAge: (...args: unknown[]) =>
    mockResolvePackageVersion(...args),
}));

jest.mock('./run', () => ({
  runSingleMigrationWorker: jest.fn(),
  runOrchestratorInit: jest.fn(),
  runOrchestratorReconcile: jest.fn(),
}));

jest.mock('../../daemon/client/client', () => ({
  daemonClient: {
    stop: jest.fn().mockResolvedValue(undefined),
    enabled: () => false,
    reset: jest.fn(),
  },
}));

jest.mock('../../config/configuration', () => ({
  ...jest.requireActual('../../config/configuration'),
  readNxJson: () => ({}),
}));

import {
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { output } from '../../utils/output';
import { setWorkspaceRoot, workspaceRoot } from '../../utils/workspace-root';
import { migrate, runMigration } from './migrate';

// Snapshot at module load: the import is a live binding, so reading it in
// afterEach would restore the value the test just set.
const originalWorkspaceRoot = workspaceRoot;

const ROOT = '/virtual-root';

function restoreEnv(name: string, value: string | undefined) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

describe('migrate() version-skew-guard wiring (temp-installation hand-off)', () => {
  const originalArgv = process.argv;
  const originalSkipInstall = process.env.NX_MIGRATE_SKIP_INSTALL;
  const originalOrchestratorEnv = process.env.NX_MIGRATE_ORCHESTRATOR;

  beforeEach(() => {
    mockAssertWorkspaceNx.mockReset().mockReturnValue(undefined);
    mockRunNxArgvSync.mockReset();
    mockRunInstall.mockReset().mockResolvedValue(undefined);
    delete process.env.NX_MIGRATE_SKIP_INSTALL;
    jest.spyOn(output, 'log').mockImplementation(() => {});
    jest.spyOn(output, 'warn').mockImplementation(() => {});
    jest.spyOn(output, 'error').mockImplementation(() => {});
    // Force both wrapper functions into the temp-installation branch:
    // __dirname (under the repo) must not start with workspaceRoot.
    setWorkspaceRoot('/__guard-wiring-spec-unrelated-root__');
  });

  afterEach(() => {
    jest.restoreAllMocks();
    setWorkspaceRoot(originalWorkspaceRoot);
    process.argv = originalArgv;
    restoreEnv('NX_MIGRATE_SKIP_INSTALL', originalSkipInstall);
    restoreEnv('NX_MIGRATE_ORCHESTRATOR', originalOrchestratorEnv);
  });

  describe('runSingleMigrationFromCli', () => {
    it('runs the guard with the raw argv before handing off to the local nx', async () => {
      const argv = ['--run-migration=@nx/js:gen'];
      const exitCode = await migrate(
        ROOT,
        { runMigration: '@nx/js:gen', skipInstall: true },
        argv
      );

      expect(exitCode).toBe(0);
      expect(mockAssertWorkspaceNx).toHaveBeenCalledWith(
        expect.objectContaining({ argv })
      );
      expect(mockRunNxArgvSync).toHaveBeenCalledTimes(1);
      expect(mockAssertWorkspaceNx.mock.invocationCallOrder[0]).toBeLessThan(
        mockRunNxArgvSync.mock.invocationCallOrder[0]
      );
    });

    it('pre-installs before the guard so it reads the freshly installed nx, then hands off', async () => {
      const exitCode = await migrate(ROOT, { runMigration: '@nx/js:gen' }, [
        '--run-migration=@nx/js:gen',
      ]);

      expect(exitCode).toBe(0);
      // runInstall's third argument is the rerun command its peer-deps
      // guidance prints.
      expect(mockRunInstall).toHaveBeenCalledWith(
        undefined,
        'pre-migration',
        'nx migrate --run-migration=@nx/js:gen'
      );
      expect(mockRunInstall.mock.invocationCallOrder[0]).toBeLessThan(
        mockAssertWorkspaceNx.mock.invocationCallOrder[0]
      );
      expect(mockAssertWorkspaceNx.mock.invocationCallOrder[0]).toBeLessThan(
        mockRunNxArgvSync.mock.invocationCallOrder[0]
      );
    });

    it('skips the pre-install when recording into a run, which pays for one per dispensed command', async () => {
      const exitCode = await migrate(
        ROOT,
        { runMigration: '@nx/js:gen', runId: 'run-1' },
        ['--run-migration=@nx/js:gen', '--run-id=run-1']
      );

      expect(exitCode).toBe(0);
      expect(mockRunInstall).not.toHaveBeenCalled();
      // The run's own worker still installs what the migration changed; only
      // the wrapper's blanket pre-install is skipped.
      expect(mockRunNxSync).toHaveBeenCalledTimes(1);
    });

    it('reads the local nx version from the workspace root, not the invocation directory', async () => {
      const wsRoot = realpathSync(
        mkdtempSync(join(tmpdir(), 'guard-wiring-ws-'))
      );
      mkdirSync(join(wsRoot, 'node_modules', 'nx'), { recursive: true });
      writeFileSync(
        join(wsRoot, 'node_modules', 'nx', 'package.json'),
        JSON.stringify({ name: 'nx', version: '5.5.5' })
      );
      setWorkspaceRoot(wsRoot);

      try {
        await migrate(ROOT, { runMigration: '@nx/js:gen', skipInstall: true }, [
          '--run-migration=@nx/js:gen',
        ]);

        const guardOptions = mockAssertWorkspaceNx.mock.calls[0][0] as {
          readLocalNxVersion: () => string | undefined;
        };
        expect(guardOptions.readLocalNxVersion()).toBe('5.5.5');
      } finally {
        rmSync(wsRoot, { recursive: true, force: true });
      }
    });

    it('never hands off to the local nx when the guard refuses', async () => {
      mockAssertWorkspaceNx.mockImplementation(() => {
        throw new Error('workspace nx too old');
      });

      const exitCode = await migrate(
        ROOT,
        { runMigration: '@nx/js:gen', skipInstall: true },
        ['--run-migration=@nx/js:gen']
      );

      expect(exitCode).toBe(1);
      expect(mockRunNxArgvSync).not.toHaveBeenCalled();
    });
  });

  describe('runOrchestratorReconcileFromCli', () => {
    it('runs the guard with the raw argv before handing off to the local nx', async () => {
      const argv = ['--run-id=abc123'];
      const exitCode = await migrate(ROOT, { runId: 'abc123' }, argv);

      expect(exitCode).toBe(0);
      expect(mockAssertWorkspaceNx).toHaveBeenCalledWith(
        expect.objectContaining({ argv })
      );
      expect(mockRunNxSync).toHaveBeenCalledTimes(1);
      expect(mockAssertWorkspaceNx.mock.invocationCallOrder[0]).toBeLessThan(
        mockRunNxSync.mock.invocationCallOrder[0]
      );
    });

    it('never hands off to the local nx when the guard refuses', async () => {
      mockAssertWorkspaceNx.mockImplementation(() => {
        throw new Error('workspace nx too old');
      });

      const exitCode = await migrate(ROOT, { runId: 'abc123' }, [
        '--run-id=abc123',
      ]);

      expect(exitCode).toBe(1);
      expect(mockRunNxSync).not.toHaveBeenCalled();
    });
  });
});

describe('runMigration() version-skew-guard wiring (temp-CLI install)', () => {
  const originalArgv = process.argv;
  const originalUseLocal = process.env.NX_USE_LOCAL;
  const originalMigrateUseLocal = process.env.NX_MIGRATE_USE_LOCAL;
  const originalCliVersion = process.env.NX_MIGRATE_CLI_VERSION;
  // nxCliPath() appends the temp installation to NODE_PATH.
  const originalNodePath = process.env.NODE_PATH;

  beforeEach(() => {
    mockResolveRunTarget.mockReset().mockResolvedValue('temp-cli');
    mockEnsurePackageHasProvenance.mockReset();
    mockResolvePackageVersion.mockReset().mockResolvedValue('23.2.0');
    mockRunNxArgvSync.mockReset();
    mockExecSync.mockReset();
    mockTmpDirSync.mockReset();
    jest.spyOn(output, 'log').mockImplementation(() => {});
    jest.spyOn(output, 'warn').mockImplementation(() => {});
    jest.spyOn(output, 'error').mockImplementation(() => {});
    delete process.env.NX_USE_LOCAL;
    delete process.env.NX_MIGRATE_USE_LOCAL;
    delete process.env.NX_MIGRATE_CLI_VERSION;
    process.argv = ['node', 'nx', 'migrate', '--run-migration=@nx/js:gen'];
  });

  afterEach(() => {
    jest.restoreAllMocks();
    process.argv = originalArgv;
    restoreEnv('NX_USE_LOCAL', originalUseLocal);
    restoreEnv('NX_MIGRATE_USE_LOCAL', originalMigrateUseLocal);
    restoreEnv('NX_MIGRATE_CLI_VERSION', originalCliVersion);
    restoreEnv('NODE_PATH', originalNodePath);
  });

  function stubTempCliInstall(bin?: unknown): string {
    const tmpDir = realpathSync(
      mkdtempSync(join(tmpdir(), 'guard-wiring-temp-cli-'))
    );
    mkdirSync(join(tmpDir, 'node_modules', 'nx'), { recursive: true });
    writeFileSync(
      join(tmpDir, 'node_modules', 'nx', 'package.json'),
      JSON.stringify({ name: 'nx', version: '23.2.0', ...(bin ? { bin } : {}) })
    );
    mockTmpDirSync.mockReturnValue({ name: tmpDir });
    return tmpDir;
  }

  it('runs the router with the raw argv before installing the temp CLI', async () => {
    // The first step of the temp-CLI install (nxCliPath), so rejecting it
    // aborts before any real install runs.
    mockEnsurePackageHasProvenance.mockRejectedValue(
      new Error('stub: no network in tests')
    );

    const exitCode = await runMigration();

    expect(exitCode).toBe(1);
    expect(mockResolveRunTarget).toHaveBeenCalledWith(
      expect.objectContaining({
        argv: ['--run-migration=@nx/js:gen'],
        cliVersionSpec: 'latest',
        fromEnvOverride: false,
        ownNxVersion: expect.any(String),
      })
    );
    expect(mockEnsurePackageHasProvenance).toHaveBeenCalledWith('nx', 'latest');
    expect(mockResolveRunTarget.mock.invocationCallOrder[0]).toBeLessThan(
      mockEnsurePackageHasProvenance.mock.invocationCallOrder[0]
    );

    // The resolver must probe without side effects: a minimum-release-age
    // violation has to reject and route local, not prompt or write pnpm
    // excludes.
    const { resolveVersion } = mockResolveRunTarget.mock.calls[0][0] as {
      resolveVersion: (spec: string) => Promise<string>;
    };
    await expect(resolveVersion('latest')).resolves.toBe('23.2.0');
    expect(mockResolvePackageVersion).toHaveBeenCalledWith('nx', 'latest', {
      applySideEffects: false,
    });
  });

  it('runs the local nx without consulting the router when the argv names an existing run', async () => {
    // The workspace-local nx owns the run state, so a temp installation would
    // only hand back to it after paying for its own install; the dispensed
    // commands rely on this instead of carrying NX_MIGRATE_USE_LOCAL.
    process.argv = ['node', 'nx', 'migrate', '--run-id=run-1'];

    const exitCode = await runMigration();

    expect(exitCode).toBe(0);
    expect(mockResolveRunTarget).not.toHaveBeenCalled();
    expect(mockEnsurePackageHasProvenance).not.toHaveBeenCalled();
    expect(mockRunNxSync).toHaveBeenCalledTimes(1);
    expect(mockRunNxSync.mock.calls[0][0]).toBe('_migrate --run-id=run-1');
  });

  it('runs the local nx instead of installing the temp CLI when routed to local-nx', async () => {
    mockResolveRunTarget.mockResolvedValue('local-nx');

    const exitCode = await runMigration();

    expect(exitCode).toBe(0);
    expect(mockEnsurePackageHasProvenance).not.toHaveBeenCalled();
    expect(mockRunNxArgvSync).toHaveBeenCalledTimes(1);
    expect(mockRunNxArgvSync.mock.calls[0][0]).toEqual([
      '_migrate',
      '--run-migration=@nx/js:gen',
    ]);
  });

  it('neither installs the temp CLI nor runs the local nx when the router refuses', async () => {
    mockResolveRunTarget.mockRejectedValue(
      new Error('neither side supports the flag')
    );

    const exitCode = await runMigration();

    expect(exitCode).toBe(1);
    expect(mockEnsurePackageHasProvenance).not.toHaveBeenCalled();
    expect(mockRunNxArgvSync).not.toHaveBeenCalled();
  });

  it('spawns the entry point the temp installation declares, not a fixed layout', async () => {
    const tmpDir = stubTempCliInstall({ nx: './dist/bin/nx.js' });

    try {
      const exitCode = await runMigration();

      expect(exitCode).toBe(0);
      expect(mockRunNxArgvSync).toHaveBeenCalledTimes(1);
      expect(mockRunNxArgvSync.mock.calls[0][0]).toEqual([
        '_migrate',
        '--run-migration=@nx/js:gen',
      ]);
      expect(mockRunNxArgvSync.mock.calls[0][1]).toMatchObject({
        nxBin: join(tmpDir, 'node_modules', 'nx', 'dist', 'bin', 'nx.js'),
      });
      expect(
        mockExecSync.mock.calls.filter(([cmd]: [string]) =>
          cmd.includes('_migrate')
        )
      ).toEqual([]);
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('falls back to the temp installation shim when its manifest names no nx bin', async () => {
    const tmpDir = stubTempCliInstall();
    process.argv = [...process.argv, '--commit-prefix=chore(repo): '];
    const originalPlatform = process.platform;
    Object.defineProperty(process, 'platform', { value: 'linux' });

    try {
      const exitCode = await runMigration();

      expect(exitCode).toBe(0);
      expect(mockRunNxArgvSync).not.toHaveBeenCalled();
      expect(mockExecSync).toHaveBeenCalledWith(
        `${join(
          tmpDir,
          'node_modules',
          '.bin',
          'nx'
        )} _migrate --run-migration=@nx/js:gen '--commit-prefix=chore(repo): '`,
        expect.objectContaining({ windowsHide: true })
      );
    } finally {
      Object.defineProperty(process, 'platform', { value: originalPlatform });
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('does not hand off to an nx installed above the temp directory', async () => {
    // The temp installation declares nx itself, so a hoisted nx above it is
    // one nobody asked for, and the system temp directory is shared.
    const tmpDir = realpathSync(
      mkdtempSync(join(tmpdir(), 'guard-wiring-temp-cli-'))
    );
    const installDir = join(tmpDir, 'install');
    mkdirSync(join(tmpDir, 'node_modules', 'nx'), { recursive: true });
    writeFileSync(
      join(tmpDir, 'node_modules', 'nx', 'package.json'),
      JSON.stringify({ name: 'nx', bin: { nx: './dist/bin/nx.js' } })
    );
    mkdirSync(installDir, { recursive: true });
    mockTmpDirSync.mockReturnValue({ name: installDir });

    try {
      const exitCode = await runMigration();

      expect(exitCode).toBe(0);
      expect(mockRunNxArgvSync).not.toHaveBeenCalled();
      expect(mockExecSync).toHaveBeenCalledWith(
        `${join(
          installDir,
          'node_modules',
          '.bin',
          'nx'
        )} _migrate --run-migration=@nx/js:gen`,
        expect.objectContaining({ windowsHide: true })
      );
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
