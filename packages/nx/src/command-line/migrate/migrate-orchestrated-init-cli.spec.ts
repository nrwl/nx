// Dispatch-level tests for the orchestrated branch of `migrate()`: the run is
// started once and then driven by an outer agent, so everything the run
// decides for itself is decided here. Kept in its own file so the module mocks
// below don't leak into the other migrate specs.

const mockRunOrchestratorInit = vi.fn();
// migrate.ts lazy-requires ./run (CJS channel), which vi.mock cannot
// intercept; replace the module in the require channel instead.
import { mockCjsModule } from '../../internal-testing-utils/cjs-mock';
mockCjsModule(import.meta.url, './run', {
  runSingleMigrationWorker: vi.fn(),
  runOrchestratorInit: (...args: unknown[]) => mockRunOrchestratorInit(...args),
  runOrchestratorReconcile: vi.fn(),
});

const mockIsInsideAgent = vi.fn();
vi.mock('./agentic/inception', async () => ({
  ...(await vi.importActual('./agentic/inception')),
  isInsideAgent: () => mockIsInsideAgent(),
}));

// The classic loop's entry marker, used to prove the dispatch fell through to
// it rather than merely skipping the orchestrator.
const mockReportRunStart = vi.fn();
vi.mock('./migrate-analytics', async () => ({
  ...(await vi.importActual('./migrate-analytics')),
  reportMigrateRunStart: (...args: unknown[]) => mockReportRunStart(...args),
}));

// The confirmation itself stays real so the branch resolution behind it is
// exercised; only the terminal prompt is stubbed.
const mockCanPrompt = vi.fn();
const mockMigrateConfirm = vi.fn();
vi.mock('./safe-prompt', async () => ({
  ...(await vi.importActual('./safe-prompt')),
  canPrompt: (...args: unknown[]) => mockCanPrompt(...args),
  migrateConfirm: (...args: unknown[]) => mockMigrateConfirm(...args),
}));

const mockIsGitRepository = vi.fn();
const mockGetGitCurrentBranch = vi.fn();
const mockGetGitRemoteNames = vi.fn(() => [] as string[]);
vi.mock('../../utils/git-utils', async () => ({
  ...(await vi.importActual('../../utils/git-utils')),
  isGitRepository: (...args: unknown[]) => mockIsGitRepository(...args),
  getGitCurrentBranch: (...args: unknown[]) => mockGetGitCurrentBranch(...args),
  getGitRemoteNames: (...args: unknown[]) => mockGetGitRemoteNames(),
}));

vi.mock('../../config/configuration', async () => ({
  ...(await vi.importActual('../../config/configuration')),
  readNxJson: () => ({}),
}));

const mockGetBaseRef = vi.fn();
vi.mock('../../utils/command-line-utils', async () => ({
  ...(await vi.importActual('../../utils/command-line-utils')),
  getBaseRef: (...args: unknown[]) => mockGetBaseRef(...args),
}));

vi.mock('../../utils/package-json', async () => ({
  ...(await vi.importActual('../../utils/package-json')),
  readModulePackageJson: () => ({
    packageJson: { name: 'nx', version: '23.0.0' },
    path: '/virtual/nx/package.json',
  }),
}));

vi.mock('../../daemon/client/client', () => ({
  daemonClient: {
    stop: vi.fn().mockResolvedValue(undefined),
    enabled: () => false,
    reset: vi.fn(),
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
    mockReportRunStart.mockReset();
    mockIsInsideAgent.mockReset().mockReturnValue(true);
    mockCanPrompt.mockReset().mockReturnValue(true);
    mockMigrateConfirm.mockReset().mockResolvedValue(true);
    mockIsGitRepository.mockReset().mockReturnValue(true);
    mockGetGitCurrentBranch.mockReset().mockReturnValue('main');
    mockGetBaseRef.mockReset().mockReturnValue('main');
    vi.spyOn(output, 'log').mockImplementation(() => {});
    vi.spyOn(output, 'warn').mockImplementation(() => {});
    vi.spyOn(output, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.chdir(originalCwd);
    rmSync(root, { recursive: true, force: true });
    if (originalGate === undefined) delete process.env.NX_MIGRATE_ORCHESTRATOR;
    else process.env.NX_MIGRATE_ORCHESTRATOR = originalGate;
  });

  function runMigrationsArgs(overrides: Record<string, unknown> = {}) {
    return {
      runMigrations: 'migrations.json',
      skipInstall: false,
      verbose: false,
      ...overrides,
    };
  }

  it('starts no run when the default-branch commit confirmation is declined', async () => {
    mockMigrateConfirm.mockResolvedValue(false);

    await migrate(root, runMigrationsArgs(), ['--run-migrations']);

    expect(mockMigrateConfirm).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining(`default branch 'main'`),
      })
    );
    expect(mockRunOrchestratorInit).not.toHaveBeenCalled();
  });

  it('starts the run once the confirmation is accepted', async () => {
    await migrate(root, runMigrationsArgs(), ['--run-migrations']);

    expect(mockMigrateConfirm).toHaveBeenCalledTimes(1);
    expect(mockRunOrchestratorInit).toHaveBeenCalledTimes(1);
  });

  it('confirms against the local branch name when the base ref carries an origin/ prefix', async () => {
    mockGetBaseRef.mockReturnValue('origin/main');

    await migrate(root, runMigrationsArgs(), ['--run-migrations']);

    expect(mockMigrateConfirm).toHaveBeenCalledTimes(1);
  });

  it('does not confirm when the run will not commit', async () => {
    await migrate(root, runMigrationsArgs({ createCommits: false }), [
      '--run-migrations',
      '--no-create-commits',
    ]);

    expect(mockMigrateConfirm).not.toHaveBeenCalled();
    expect(mockRunOrchestratorInit).toHaveBeenCalledTimes(1);
  });

  it('does not confirm when prompting is impossible', async () => {
    mockCanPrompt.mockReturnValue(false);

    await migrate(root, runMigrationsArgs(), ['--run-migrations']);

    expect(mockMigrateConfirm).not.toHaveBeenCalled();
    expect(mockRunOrchestratorInit).toHaveBeenCalledTimes(1);
  });

  it.each<[string, () => void]>([
    [
      'the gate env var is not set',
      () => {
        delete process.env.NX_MIGRATE_ORCHESTRATOR;
      },
    ],
    [
      'no agent is driving the process',
      () => {
        mockIsInsideAgent.mockReturnValue(false);
      },
    ],
  ])('dispatches to the classic loop when %s', async (_label, arrange) => {
    arrange();

    // The classic loop runs real migration execution, which fails on this
    // fixture; only the dispatch itself is under test.
    await migrate(root, runMigrationsArgs({ agentic: false }), [
      '--run-migrations',
      '--agentic=false',
    ]).catch(() => {});

    expect(mockRunOrchestratorInit).not.toHaveBeenCalled();
    expect(mockReportRunStart).toHaveBeenCalledTimes(1);
  });

  it.each<[string, boolean, string[]]>([
    ['records --skip-install on the run', true, ['--skip-install']],
    ['records the default install policy on the run', false, []],
  ])(
    '%s, which its dispensed commands cannot carry',
    async (_label, skipInstall, extraArgs) => {
      await migrate(root, runMigrationsArgs({ skipInstall }), [
        '--run-migrations',
        ...extraArgs,
      ]);

      expect(mockRunOrchestratorInit).toHaveBeenCalledWith(
        expect.objectContaining({ root, skipInstall })
      );
    }
  );

  it.each<[string, boolean | undefined, string[]]>([
    ['forwards --validate=false to the run', false, ['--no-validate']],
    [
      'leaves the validation policy unset when the flag is omitted',
      undefined,
      [],
    ],
  ])('%s', async (_label, validate, extraArgs) => {
    await migrate(root, runMigrationsArgs({ validate }), [
      '--run-migrations',
      ...extraArgs,
    ]);

    // Raw flag value on purpose: the run records the resolved policy itself.
    expect(mockRunOrchestratorInit.mock.calls[0][0].validate).toBe(validate);
  });
});
