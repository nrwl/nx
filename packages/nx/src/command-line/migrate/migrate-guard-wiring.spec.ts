// Wiring tests for the version-skew-guard call sites in migrate.ts; the guards'
// own behavior lives in version-skew-guard.spec.ts. Kept in its own file so the
// module mocks below don't leak into the other migrate specs.

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

// Both spawn helpers are mocked: the hand-off calls runNxArgvSync, and leaving
// runNxSync live would let its fallback path spawn a real nx.
const mockRunNxSync = jest.fn();
const mockRunNxArgvSync = jest.fn();
jest.mock('../../utils/child-process', () => ({
  ...jest.requireActual('../../utils/child-process'),
  runNxSync: (...args: unknown[]) => mockRunNxSync(...args),
  runNxArgvSync: (...args: unknown[]) => mockRunNxArgvSync(...args),
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

  beforeEach(() => {
    mockAssertWorkspaceNx.mockReset().mockReturnValue(undefined);
    mockRunNxArgvSync.mockReset();
    mockRunInstall.mockReset().mockResolvedValue(undefined);
    delete process.env.NX_MIGRATE_SKIP_INSTALL;
    jest.spyOn(output, 'log').mockImplementation(() => {});
    jest.spyOn(output, 'warn').mockImplementation(() => {});
    jest.spyOn(output, 'error').mockImplementation(() => {});
    // Force the temp-installation branch: __dirname (under the repo) must not
    // start with workspaceRoot.
    setWorkspaceRoot('/__guard-wiring-spec-unrelated-root__');
  });

  afterEach(() => {
    jest.restoreAllMocks();
    setWorkspaceRoot(originalWorkspaceRoot);
    process.argv = originalArgv;
    restoreEnv('NX_MIGRATE_SKIP_INSTALL', originalSkipInstall);
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
});

describe('runMigration() version-skew-guard wiring (temp-CLI install)', () => {
  const originalArgv = process.argv;
  const originalUseLocal = process.env.NX_USE_LOCAL;
  const originalMigrateUseLocal = process.env.NX_MIGRATE_USE_LOCAL;
  const originalCliVersion = process.env.NX_MIGRATE_CLI_VERSION;

  beforeEach(() => {
    mockResolveRunTarget.mockReset().mockResolvedValue('temp-cli');
    mockEnsurePackageHasProvenance.mockReset();
    mockResolvePackageVersion.mockReset().mockResolvedValue('23.2.0');
    mockRunNxArgvSync.mockReset();
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
  });

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
});
