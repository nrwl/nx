// Dispatch-level tests for the orchestrated branch of `migrate()`: the run is
// started once and then driven by an outer agent, so everything the run
// decides for itself is decided here. Kept in its own file so the module mocks
// below don't leak into the other migrate specs.

const mockRunOrchestratorInit = jest.fn();
jest.mock('./run', () => ({
  runSingleMigrationWorker: jest.fn(),
  runOrchestratorInit: (...args: unknown[]) => mockRunOrchestratorInit(...args),
  runOrchestratorReconcile: jest.fn(),
}));

const mockIsInsideAgent = jest.fn();
jest.mock('./agentic/inception', () => ({
  ...jest.requireActual('./agentic/inception'),
  isInsideAgent: () => mockIsInsideAgent(),
}));

const mockCanPrompt = jest.fn();
jest.mock('./safe-prompt', () => ({
  ...jest.requireActual('./safe-prompt'),
  canPrompt: (...args: unknown[]) => mockCanPrompt(...args),
}));

const mockConfirmCommits = jest.fn();
jest.mock('./migrate-commits', () => ({
  ...jest.requireActual('./migrate-commits'),
  confirmCommitsOnDefaultBranch: (...args: unknown[]) =>
    mockConfirmCommits(...args),
}));

const mockIsGitRepository = jest.fn();
const mockGetGitCurrentBranch = jest.fn();
jest.mock('../../utils/git-utils', () => ({
  ...jest.requireActual('../../utils/git-utils'),
  isGitRepository: (...args: unknown[]) => mockIsGitRepository(...args),
  getGitCurrentBranch: (...args: unknown[]) => mockGetGitCurrentBranch(...args),
}));

jest.mock('../../config/configuration', () => ({
  ...jest.requireActual('../../config/configuration'),
  readNxJson: () => ({}),
}));

jest.mock('../../utils/command-line-utils', () => ({
  ...jest.requireActual('../../utils/command-line-utils'),
  getBaseRef: () => 'main',
}));

jest.mock('../../utils/package-json', () => ({
  ...jest.requireActual('../../utils/package-json'),
  readModulePackageJson: () => ({
    packageJson: { name: 'nx', version: '23.0.0' },
    path: '/virtual/nx/package.json',
  }),
}));

jest.mock('../../daemon/client/client', () => ({
  daemonClient: {
    stop: jest.fn().mockResolvedValue(undefined),
    enabled: () => false,
    reset: jest.fn(),
  },
}));

import { mkdtempSync, realpathSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { output } from '../../utils/output';
import { migrate } from './migrate';

describe('migrate() orchestrated init dispatch', () => {
  let root: string;
  const originalGate = process.env.NX_MIGRATE_ORCHESTRATOR;
  const originalCwd = process.cwd();

  beforeEach(() => {
    root = realpathSync(mkdtempSync(join(tmpdir(), 'nx-migrate-orch-cli-')));
    // The migrations file is resolved against the working directory before it
    // is read from the root.
    process.chdir(root);
    writeFileSync(
      join(root, 'migrations.json'),
      JSON.stringify({
        migrations: [
          {
            package: '@nx/js',
            name: 'gen',
            version: '1.0.0',
            implementation: './gen.js',
          },
        ],
      })
    );
    process.env.NX_MIGRATE_ORCHESTRATOR = 'true';
    mockRunOrchestratorInit.mockReset().mockResolvedValue(undefined);
    mockIsInsideAgent.mockReset().mockReturnValue(true);
    mockCanPrompt.mockReset().mockReturnValue(true);
    mockConfirmCommits.mockReset().mockResolvedValue(true);
    mockIsGitRepository.mockReset().mockReturnValue(true);
    mockGetGitCurrentBranch.mockReset().mockReturnValue('main');
    jest.spyOn(output, 'log').mockImplementation(() => {});
    jest.spyOn(output, 'warn').mockImplementation(() => {});
    jest.spyOn(output, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
    process.chdir(originalCwd);
    rmSync(root, { recursive: true, force: true });
    if (originalGate === undefined) delete process.env.NX_MIGRATE_ORCHESTRATOR;
    else process.env.NX_MIGRATE_ORCHESTRATOR = originalGate;
  });

  function runMigrationsArgs(overrides: Record<string, unknown> = {}) {
    return {
      runMigrations: 'migrations.json',
      skipInstall: true,
      verbose: false,
      ...overrides,
    };
  }

  it('starts no run when the default-branch commit confirmation is declined', async () => {
    mockConfirmCommits.mockResolvedValue(false);

    await migrate(root, runMigrationsArgs(), ['--run-migrations']);

    expect(mockConfirmCommits).toHaveBeenCalledWith({
      currentBranch: 'main',
      defaultBranch: 'main',
    });
    expect(mockRunOrchestratorInit).not.toHaveBeenCalled();
  });

  it('starts the run once the confirmation is accepted', async () => {
    await migrate(root, runMigrationsArgs(), ['--run-migrations']);

    expect(mockConfirmCommits).toHaveBeenCalledTimes(1);
    expect(mockRunOrchestratorInit).toHaveBeenCalledTimes(1);
  });

  it('does not confirm when the run will not commit', async () => {
    await migrate(root, runMigrationsArgs({ createCommits: false }), [
      '--run-migrations',
      '--no-create-commits',
    ]);

    expect(mockConfirmCommits).not.toHaveBeenCalled();
    expect(mockRunOrchestratorInit).toHaveBeenCalledTimes(1);
  });

  it('records the install policy on the run, which its dispensed commands cannot carry', async () => {
    await migrate(root, runMigrationsArgs({ skipInstall: true }), [
      '--run-migrations',
      '--skip-install',
    ]);

    expect(mockRunOrchestratorInit).toHaveBeenCalledWith(
      expect.objectContaining({ root, skipInstall: true })
    );
  });
});
