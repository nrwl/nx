// Dispatch-level tests asserting the version-skew-guard call sites in
// migrate.ts run with the invocation's raw argv and before their hand-off to
// the temp/local nx. The guard functions' own behavior is covered by
// version-skew-guard.spec.ts. Kept in its own file so the module mocks below
// (workspace-root, child-process, provenance) don't leak into the other
// migrate specs.

const mockAssertTempCli = jest.fn();
const mockAssertWorkspaceNx = jest.fn();
jest.mock('./version-skew-guard', () => ({
  ...jest.requireActual('./version-skew-guard'),
  assertTempCliSupportsNewMigrateFlags: (...args: unknown[]) =>
    mockAssertTempCli(...args),
  assertWorkspaceNxSupportsNewMigrateFlags: (...args: unknown[]) =>
    mockAssertWorkspaceNx(...args),
}));

const mockEnsurePackageHasProvenance = jest.fn();
jest.mock('../../utils/provenance', () => ({
  ...jest.requireActual('../../utils/provenance'),
  ensurePackageHasProvenance: (...args: unknown[]) =>
    mockEnsurePackageHasProvenance(...args),
}));

const mockRunNxSync = jest.fn();
jest.mock('../../utils/child-process', () => ({
  ...jest.requireActual('../../utils/child-process'),
  runNxSync: (...args: unknown[]) => mockRunNxSync(...args),
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

import { output } from '../../utils/output';
import {
  setWorkspaceRoot,
  workspaceRoot as originalWorkspaceRoot,
} from '../../utils/workspace-root';
import { migrate, runMigration } from './migrate';

const ROOT = '/virtual-root';

function restoreEnv(name: string, value: string | undefined) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

describe('migrate() version-skew-guard wiring (temp-installation hand-off)', () => {
  const originalArgv = process.argv;

  beforeEach(() => {
    mockAssertWorkspaceNx.mockReset().mockReturnValue(undefined);
    mockRunNxSync.mockReset();
    jest.spyOn(output, 'log').mockImplementation(() => {});
    jest.spyOn(output, 'warn').mockImplementation(() => {});
    jest.spyOn(output, 'error').mockImplementation(() => {});
    // Force the wrapper function into its guarded temp-installation branch:
    // __dirname (under the repo) must not start with workspaceRoot.
    setWorkspaceRoot('/__guard-wiring-spec-unrelated-root__');
  });

  afterEach(() => {
    jest.restoreAllMocks();
    setWorkspaceRoot(originalWorkspaceRoot);
    process.argv = originalArgv;
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
      expect(mockRunNxSync).toHaveBeenCalledTimes(1);
      expect(mockAssertWorkspaceNx.mock.invocationCallOrder[0]).toBeLessThan(
        mockRunNxSync.mock.invocationCallOrder[0]
      );
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
      expect(mockRunNxSync).not.toHaveBeenCalled();
    });
  });
});

describe('runMigration() version-skew-guard wiring (temp-CLI install)', () => {
  const originalArgv = process.argv;
  const originalUseLocal = process.env.NX_USE_LOCAL;
  const originalMigrateUseLocal = process.env.NX_MIGRATE_USE_LOCAL;
  const originalCliVersion = process.env.NX_MIGRATE_CLI_VERSION;

  beforeEach(() => {
    mockAssertTempCli.mockReset();
    mockEnsurePackageHasProvenance.mockReset();
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

  it('runs the guard with the raw argv before installing the temp CLI', async () => {
    mockAssertTempCli.mockResolvedValue(undefined);
    // ensurePackageHasProvenance is the first thing the temp-CLI install does
    // (nxCliPath); stub it to fail fast rather than exercise a real network
    // install.
    mockEnsurePackageHasProvenance.mockRejectedValue(
      new Error('stub: no network in tests')
    );

    const exitCode = await runMigration();

    expect(exitCode).toBe(1);
    expect(mockAssertTempCli).toHaveBeenCalledWith(
      expect.objectContaining({
        argv: ['--run-migration=@nx/js:gen'],
        cliVersionSpec: 'latest',
        fromEnvOverride: false,
      })
    );
    expect(mockEnsurePackageHasProvenance).toHaveBeenCalledWith('nx', 'latest');
    expect(mockAssertTempCli.mock.invocationCallOrder[0]).toBeLessThan(
      mockEnsurePackageHasProvenance.mock.invocationCallOrder[0]
    );
  });

  it('never starts the temp-CLI install when the guard refuses', async () => {
    mockAssertTempCli.mockRejectedValue(new Error('temp CLI too old'));

    const exitCode = await runMigration();

    expect(exitCode).toBe(1);
    expect(mockEnsurePackageHasProvenance).not.toHaveBeenCalled();
  });
});
