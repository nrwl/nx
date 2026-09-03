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

// The default-branch stop never prompts, prompt-capable terminal or not; both
// are stubbed to prove it.
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

const mockReadNxJson = vi.fn();
vi.mock('../../config/configuration', async () => ({
  ...(await vi.importActual('../../config/configuration')),
  readNxJson: (...args: unknown[]) => mockReadNxJson(...args),
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
    mockGetGitCurrentBranch.mockReset().mockReturnValue('feat/migrate');
    mockGetBaseRef.mockReset().mockReturnValue('main');
    mockReadNxJson.mockReset().mockReturnValue({});
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

  it('stops without a run when commits default on and the branch is the default one', async () => {
    mockGetGitCurrentBranch.mockReturnValue('main');

    await migrate(root, runMigrationsArgs(), ['--run-migrations']);

    expect(mockRunOrchestratorInit).not.toHaveBeenCalled();
    // Prompting was possible, and still nothing asked: the stop is the answer.
    expect(mockMigrateConfirm).not.toHaveBeenCalled();
    expect(output.log).toHaveBeenCalledWith({
      title: `Not starting the run: you are on the default branch 'main' and nx migrate would create a commit for each migration on it.`,
      bodyLines: [
        'Ask the user how to proceed, then either:',
        '- re-run with --create-commits to commit on this branch for this run,',
        '- set "migrate": { "createCommits": true } in nx.json to always allow it, then re-run,',
        '- or switch to another branch and re-run.',
      ],
    });
  });

  it('stops against the local branch name when the base ref carries an origin/ prefix', async () => {
    mockGetGitCurrentBranch.mockReturnValue('main');
    mockGetBaseRef.mockReturnValue('origin/main');

    await migrate(root, runMigrationsArgs(), ['--run-migrations']);

    expect(mockRunOrchestratorInit).not.toHaveBeenCalled();
    expect(output.log).toHaveBeenCalledWith(
      expect.objectContaining({
        title: expect.stringContaining(`default branch 'main'`),
      })
    );
  });

  it('starts the run on the default branch when --create-commits is passed', async () => {
    mockGetGitCurrentBranch.mockReturnValue('main');

    await migrate(root, runMigrationsArgs({ createCommits: true }), [
      '--run-migrations',
      '--create-commits',
    ]);

    expect(mockMigrateConfirm).not.toHaveBeenCalled();
    expect(mockRunOrchestratorInit).toHaveBeenCalledTimes(1);
  });

  it('starts the run on the default branch when nx.json enables commits', async () => {
    mockGetGitCurrentBranch.mockReturnValue('main');
    mockReadNxJson.mockReturnValue({ migrate: { createCommits: true } });

    await migrate(root, runMigrationsArgs(), ['--run-migrations']);

    expect(mockMigrateConfirm).not.toHaveBeenCalled();
    expect(mockRunOrchestratorInit).toHaveBeenCalledTimes(1);
  });

  it('starts the run on the default branch when the run will not commit', async () => {
    mockGetGitCurrentBranch.mockReturnValue('main');

    await migrate(root, runMigrationsArgs({ createCommits: false }), [
      '--run-migrations',
      '--no-create-commits',
    ]);

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
