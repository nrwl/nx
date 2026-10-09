// Dispatch-level tests for the orchestrated branch of `migrate()`: the run is
// started once and then driven by an outer agent, so everything the run
// decides for itself is decided here. Kept in its own file so the module mocks
// below don't leak into the other migrate specs.

const mockRunOrchestratorInit = vi.fn();
const mockRunOrchestratorResume = vi.fn();
const mockHoldRunToContinue = vi.fn();
const mockActiveRunToReplace = vi.fn();
const mockActiveRunForClassic = vi.fn();
const mockCheckRunForStartFresh = vi.fn();
const mockDeleteRunForStartFresh = vi.fn();
// migrate.ts lazy-requires ./run (CJS channel), which vi.mock cannot
// intercept; replace the module in the require channel instead.
import { mockCjsModule } from '../../internal-testing-utils/cjs-mock';
import {
  type ExistingRunFacts,
  renderContinueCommand,
  renderExistingRunCommands,
  renderExistingRunReport,
} from './run/existing-run-report';
import {
  activeRunForClassic,
  checkRunForStartFresh,
  deleteRunForStartFresh,
} from './run/orchestrator';
import {
  type MigrateRunState,
  runDir,
  TERMINAL_STEP_STATUSES,
  unsafeMigrationIds,
  writeRunState,
} from './run/run-state';
import { latestRound, stepLabel } from './run/state-machine';
import { pmInstallCommand } from './run/util';
mockCjsModule(import.meta.url, './run', {
  runSingleMigrationWorker: vi.fn(),
  runOrchestratorInit: (...args: unknown[]) => mockRunOrchestratorInit(...args),
  runOrchestratorReconcile: vi.fn(),
  runOrchestratorResume: (...args: unknown[]) =>
    mockRunOrchestratorResume(...args),
  holdRunToContinue: (...args: unknown[]) => mockHoldRunToContinue(...args),
  activeRunToReplace: (...args: unknown[]) => mockActiveRunToReplace(...args),
  activeRunForClassic: (...args: unknown[]) => mockActiveRunForClassic(...args),
  checkRunForStartFresh: (...args: unknown[]) =>
    mockCheckRunForStartFresh(...args),
  deleteRunForStartFresh: (...args: unknown[]) =>
    mockDeleteRunForStartFresh(...args),
  latestRound,
  pmInstallCommand,
  renderContinueCommand,
  renderExistingRunCommands,
  renderExistingRunReport,
  runDir,
  stepLabel,
  TERMINAL_STEP_STATUSES,
  unsafeMigrationIds,
});
const mockRunMasterSession = vi.fn();
mockCjsModule(import.meta.url, './agentic/master/run-master-session', {
  runMasterSession: (...args: unknown[]) => mockRunMasterSession(...args),
});
// Stubbed the same way: the user-initiated path resolves the agentic flow
// before it can branch to the master session.
const mockResolveAgentic = vi.fn();
mockCjsModule(import.meta.url, './agentic/select', {
  ...require('./agentic/select'),
  resolveAgentic: (...args: unknown[]) => mockResolveAgentic(...args),
});

// Hoisted with the mock: the native module is read at import time.
const wasm = vi.hoisted(() => ({ active: false }));
vi.mock('../../native', async () => ({
  ...(await vi.importActual('../../native')),
  get IS_WASM() {
    return wasm.active;
  },
}));

const mockIsInsideAgent = vi.fn();
vi.mock('./agentic/inception', async () => ({
  ...(await vi.importActual('./agentic/inception')),
  isInsideAgent: () => mockIsInsideAgent(),
}));

const mockIsCI = vi.fn();
vi.mock('../../utils/is-ci', async () => ({
  ...(await vi.importActual('../../utils/is-ci')),
  isCI: () => mockIsCI(),
}));

// The classic loop's entry marker, used to prove the dispatch fell through to
// it rather than merely skipping the orchestrator.
const mockReportRunStart = vi.fn();
const mockReportRunStopped = vi.fn();
vi.mock('./migrate-analytics', async () => ({
  ...(await vi.importActual('./migrate-analytics')),
  reportMigrateRunStart: (...args: unknown[]) => mockReportRunStart(...args),
  reportMigrateRunStopped: (...args: unknown[]) =>
    mockReportRunStopped(...args),
}));

// The default-branch stop never prompts, prompt-capable terminal or not; both
// are stubbed to prove it.
const mockCanPrompt = vi.fn();
const mockMigrateConfirm = vi.fn();
const mockMigrateChoice = vi.fn();
vi.mock('./safe-prompt', async () => ({
  ...(await vi.importActual('./safe-prompt')),
  canPrompt: (...args: unknown[]) => mockCanPrompt(...args),
  migrateConfirm: (...args: unknown[]) => mockMigrateConfirm(...args),
  migrateChoice: (...args: unknown[]) => mockMigrateChoice(...args),
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

const mockRunInstall = vi.fn();
vi.mock('./execute-migration', async () => ({
  ...(await vi.importActual('./execute-migration')),
  runInstall: (...args: unknown[]) => mockRunInstall(...args),
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

import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { FileLock } from '../../native';
import { output } from '../../utils/output';
import { migrate } from './migrate';

describe('migrate() orchestrated init dispatch', () => {
  let root: string;
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
    mockRunOrchestratorInit.mockReset().mockResolvedValue(undefined);
    mockRunOrchestratorResume.mockReset().mockReturnValue(undefined);
    mkdirSync(runDir(root, 'run-1'), { recursive: true });
    writeFileSync(
      join(runDir(root, 'run-1'), 'plan-0.json'),
      JSON.stringify({ migrations: [] })
    );
    mockHoldRunToContinue.mockReset().mockReturnValue({
      rounds: [{ index: 0, planSnapshot: 'plan-0.json' }],
      steps: [],
    });
    mockActiveRunToReplace.mockReset();
    mockActiveRunForClassic.mockReset().mockReturnValue(null);
    mockCheckRunForStartFresh.mockReset();
    mockDeleteRunForStartFresh.mockReset();
    mockRunInstall.mockReset().mockResolvedValue(undefined);
    mockRunMasterSession.mockReset().mockResolvedValue(undefined);
    mockResolveAgentic.mockReset().mockResolvedValue({ kind: 'disabled' });
    mockReportRunStart.mockReset();
    mockReportRunStopped.mockReset();
    mockIsInsideAgent.mockReset().mockReturnValue(true);
    mockIsCI.mockReset().mockReturnValue(false);
    mockCanPrompt.mockReset().mockReturnValue(true);
    mockMigrateConfirm.mockReset().mockResolvedValue(true);
    mockMigrateChoice.mockReset();
    mockIsGitRepository.mockReset().mockReturnValue(true);
    mockGetGitCurrentBranch.mockReset().mockReturnValue('feat/migrate');
    mockGetBaseRef.mockReset().mockReturnValue('main');
    mockReadNxJson.mockReset().mockReturnValue({});
    wasm.active = false;
    vi.spyOn(output, 'log').mockImplementation(() => {});
    vi.spyOn(output, 'warn').mockImplementation(() => {});
    vi.spyOn(output, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.chdir(originalCwd);
    rmSync(root, { recursive: true, force: true });
  });

  function runMigrationsArgs(overrides: Record<string, unknown> = {}) {
    return {
      runMigrations: 'migrations.json',
      skipInstall: false,
      verbose: false,
      ...overrides,
    };
  }

  // The default-branch check is handed to init as confirmStart, which asks
  // only once it is about to start a run; the mock never does, so the
  // closure is exercised directly.
  async function confirmStartFromInit(): Promise<boolean> {
    expect(mockRunOrchestratorInit).toHaveBeenCalledTimes(1);
    const { confirmStart } = mockRunOrchestratorInit.mock.calls[0][0];
    return confirmStart();
  }

  it('refuses the start when commits default on and the branch is the default one', async () => {
    mockGetGitCurrentBranch.mockReturnValue('main');

    await migrate(root, runMigrationsArgs(), ['--run-migrations']);

    expect(await confirmStartFromInit()).toBe(false);
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

  it('refuses against the local branch name when the base ref carries an origin/ prefix', async () => {
    mockGetGitCurrentBranch.mockReturnValue('main');
    mockGetBaseRef.mockReturnValue('origin/main');

    await migrate(root, runMigrationsArgs(), ['--run-migrations']);

    expect(await confirmStartFromInit()).toBe(false);
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

    expect(await confirmStartFromInit()).toBe(true);
    expect(mockMigrateConfirm).not.toHaveBeenCalled();
  });

  it('starts the run on the default branch when nx.json enables commits', async () => {
    mockGetGitCurrentBranch.mockReturnValue('main');
    mockReadNxJson.mockReturnValue({ migrate: { createCommits: true } });

    await migrate(root, runMigrationsArgs(), ['--run-migrations']);

    expect(await confirmStartFromInit()).toBe(true);
    expect(mockMigrateConfirm).not.toHaveBeenCalled();
  });

  it('starts the run on the default branch when the run will not commit', async () => {
    mockGetGitCurrentBranch.mockReturnValue('main');

    await migrate(root, runMigrationsArgs({ createCommits: false }), [
      '--run-migrations',
      '--no-create-commits',
    ]);

    expect(mockRunOrchestratorInit).toHaveBeenCalledTimes(1);
  });

  it.each<[string, Record<string, unknown>, string[], () => void]>([
    [
      '--agentic=false is passed',
      { agentic: false },
      ['--agentic=false'],
      () => {},
    ],
    [
      'nx.json sets migrate.agentic to false',
      {},
      [],
      () => {
        mockReadNxJson.mockReturnValue({ migrate: { agentic: false } });
      },
    ],
    [
      'it runs in CI',
      {},
      [],
      () => {
        mockIsCI.mockReturnValue(true);
      },
    ],
    [
      'it runs on the WASM build',
      {},
      [],
      () => {
        wasm.active = true;
      },
    ],
    [
      'no agent is driving the process',
      {},
      [],
      () => {
        mockIsInsideAgent.mockReturnValue(false);
      },
    ],
  ])(
    'dispatches to the classic loop when %s',
    async (_label, overrides, flags, arrange) => {
      arrange();

      // The classic loop runs real migration execution, which fails on this
      // fixture; only the dispatch itself is under test.
      await migrate(root, runMigrationsArgs(overrides), [
        '--run-migrations',
        ...flags,
      ]).catch(() => {});

      expect(mockRunOrchestratorInit).not.toHaveBeenCalled();
      expect(mockReportRunStart).toHaveBeenCalledTimes(1);
    }
  );

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

  it('continues the run --run-id names through the resume entry point, on the plan the run recorded', async () => {
    // The workspace file is not read: the run may outlive it.
    rmSync(join(root, 'migrations.json'));

    await migrate(
      root,
      runMigrationsArgs({ runId: 'run-1', agentic: 'claude-code' }),
      ['--run-migrations', '--agentic=claude-code', '--run-id=run-1']
    );

    expect(mockRunOrchestratorResume).toHaveBeenCalledWith({
      root,
      runId: 'run-1',
      policy: { createCommits: true, skipInstall: false },
    });
    expect(mockRunOrchestratorInit).not.toHaveBeenCalled();
    expect(mockRunInstall).toHaveBeenCalled();
  });

  it.each([
    [
      'says which install a retry runs again and which is left to the user',
      false,
    ],
    ['says nothing of it under --skip-install, which skips it anyway', true],
  ])(
    'continues a run whose step install failed without the preflight install, which would fail on the same cause, and %s',
    async (_, skipInstall) => {
      mockHoldRunToContinue.mockReturnValue({
        rounds: [{ index: 0, planSnapshot: 'plan-0.json' }],
        steps: [
          {
            kind: 'migration',
            id: 'step-1',
            migrationId: '@nx/js:gen',
            status: 'failed',
            installFailed: true,
          },
          {
            kind: 'migration',
            id: 'step-2',
            // Migration ids are not checked for line breaks.
            migrationId: '@nx/js:other\nnext',
            status: 'skipped',
            installFailed: true,
          },
        ],
      });

      await migrate(
        root,
        runMigrationsArgs({
          runId: 'run-1',
          agentic: 'claude-code',
          skipInstall,
        }),
        [
          '--run-migrations',
          '--agentic=claude-code',
          '--run-id=run-1',
          ...(skipInstall ? ['--skip-install'] : []),
        ]
      );

      expect(mockRunInstall).not.toHaveBeenCalled();
      expect(
        vi
          .mocked(output.warn)
          .mock.calls.filter(
            ([message]) => message.title === 'Skipping the dependency install'
          )
      ).toEqual(
        skipInstall
          ? []
          : [
              [
                {
                  title: 'Skipping the dependency install',
                  bodyLines: [
                    'The dependency install of @nx/js:gen did not complete earlier in this run. Retrying that step installs again; any other choice leaves the install to you.',
                    `The dependency install of @nx/js:other next did not complete earlier in this run. Run \`${pmInstallCommand(root)}\` once the cause of the failed install is fixed.`,
                  ],
                },
              ],
            ]
      );
      expect(mockRunOrchestratorResume).toHaveBeenCalled();
    }
  );

  it('refuses a start-fresh naming no active run before the preflight install', async () => {
    mockActiveRunToReplace.mockImplementation(() => {
      throw new Error('nothing to replace');
    });

    expect(
      await migrate(
        root,
        runMigrationsArgs({ runId: 'run-1', startFresh: true }),
        ['--run-migrations', '--start-fresh', '--run-id=run-1']
      )
    ).toBe(1);

    expect(mockActiveRunToReplace).toHaveBeenCalledWith(root, 'run-1');
    expect(mockRunInstall).not.toHaveBeenCalled();
    expect(mockRunOrchestratorInit).not.toHaveBeenCalled();
  });

  it('replaces the run --start-fresh --run-id names through init, on the workspace plan', async () => {
    await migrate(
      root,
      runMigrationsArgs({ startFresh: true, runId: 'run-1' }),
      ['--run-migrations', '--start-fresh', '--run-id=run-1']
    );

    expect(mockRunOrchestratorResume).not.toHaveBeenCalled();
    expect(mockRunOrchestratorInit).toHaveBeenCalledWith(
      expect.objectContaining({
        migrationsJson: expect.objectContaining({
          migrations: [expect.objectContaining({ name: 'gen' })],
        }),
        onExistingRun: 'start-fresh',
        replaceRunId: 'run-1',
      })
    );
  });

  const continueNeedsOrchestration = `'--run-id' continues an orchestrated migrate run, and this invocation is not orchestrated. Orchestration needs an enabled agent, or an AI agent running nx outside CI; --agentic=false and the WASM build turn it off.`;

  // The classic loop records no run, so it cannot continue one; every route
  // out of the orchestrator refuses the continue instead of ignoring it.
  it.each<[string, () => void]>([
    [
      'the outer agent runs nx in CI',
      () => {
        mockIsCI.mockReturnValue(true);
      },
    ],
    [
      'a non-interactive terminal turns the agentic flow off',
      () => {
        mockIsInsideAgent.mockReturnValue(false);
      },
    ],
  ])('refuses --run-id when %s', async (_label, arrange) => {
    arrange();

    // migrate() reports through handleErrors and returns the exit code.
    expect(
      await migrate(
        root,
        runMigrationsArgs({ runId: 'run-1', agentic: 'claude-code' }),
        ['--run-migrations', '--agentic=claude-code', '--run-id=run-1']
      )
    ).toBe(1);
    expect(output.error).toHaveBeenCalledWith(
      expect.objectContaining({ title: continueNeedsOrchestration })
    );

    expect(mockRunOrchestratorInit).not.toHaveBeenCalled();
    expect(mockRunOrchestratorResume).not.toHaveBeenCalled();
    expect(mockRunMasterSession).not.toHaveBeenCalled();
    expect(output.log).not.toHaveBeenCalledWith(
      expect.objectContaining({
        title: expect.stringContaining('Running migrations from'),
      })
    );
  });

  it('refuses --run-id on the WASM build before the preflight install and the hold', async () => {
    wasm.active = true;

    expect(
      await migrate(
        root,
        runMigrationsArgs({ runId: 'run-1', agentic: 'claude-code' }),
        ['--run-migrations', '--agentic=claude-code', '--run-id=run-1']
      )
    ).toBe(1);

    expect(mockRunInstall).not.toHaveBeenCalled();
    expect(mockHoldRunToContinue).not.toHaveBeenCalled();
  });

  describe('a plan with a migration id orchestration cannot dispense', () => {
    const agent = {
      id: 'claude-code',
      displayName: 'Claude Code',
      binary: '/usr/local/bin/claude',
      source: 'path',
    };
    const asUser = () => {
      mockIsInsideAgent.mockReturnValue(false);
      mockResolveAgentic.mockResolvedValue({
        kind: 'enabled',
        selectedAgent: agent,
      });
    };

    beforeEach(() => {
      writeFileSync(
        join(root, 'migrations.json'),
        JSON.stringify({
          migrations: [
            {
              package: '@nx/js',
              name: 'rename files',
              version: '1.0.0',
              implementation: './gen.js',
            },
          ],
        })
      );
    });

    it.each<[string, () => void, Record<string, unknown>, string[], string]>([
      [
        'an outer agent drives the run',
        () => {},
        {},
        [],
        'Running the migrations without an orchestrated run: orchestrated runs need shell-safe migration ids (letters, digits and @/:._-), and these are not:',
      ],
      [
        'the user enabled the agentic flow',
        asUser,
        { agentic: 'claude-code' },
        ['--agentic=claude-code'],
        'Skipping the agentic flow: it needs shell-safe migration ids (letters, digits and @/:._-), and these are not:',
      ],
    ])(
      'runs it on the classic loop, naming the id, when %s',
      async (_label, arrange, overrides, flags, title) => {
        arrange();

        // The classic loop runs real migration execution, which fails on this
        // fixture; only the dispatch itself is under test.
        await migrate(root, runMigrationsArgs(overrides), [
          '--run-migrations',
          ...flags,
        ]).catch(() => {});

        expect(mockRunOrchestratorInit).not.toHaveBeenCalled();
        expect(mockRunMasterSession).not.toHaveBeenCalled();
        expect(output.warn).toHaveBeenCalledWith({
          title,
          bodyLines: ['- @nx/js:rename files', expect.any(String)],
        });
        expect(output.log).toHaveBeenCalledWith(
          expect.objectContaining({
            title: expect.stringContaining('Running migrations from'),
          })
        );
      }
    );

    it.each<
      [string, () => void, Record<string, unknown>, string[], () => void]
    >([
      [
        'an outer agent drives the run',
        () => {},
        {},
        [],
        () =>
          expect(mockRunOrchestratorInit).toHaveBeenCalledWith(
            expect.objectContaining({
              onExistingRun: 'start-fresh',
              replaceRunId: 'run-1',
            })
          ),
      ],
      [
        'the user enabled the agentic flow',
        asUser,
        { agentic: 'claude-code' },
        ['--agentic=claude-code'],
        () =>
          expect(mockRunMasterSession).toHaveBeenCalledWith(
            expect.objectContaining({ startFresh: true, runId: 'run-1' })
          ),
      ],
    ])(
      'leaves a start fresh to init, which refuses the id, when %s',
      async (_label, arrange, overrides, flags, expectInit) => {
        arrange();

        await migrate(
          root,
          runMigrationsArgs({ ...overrides, startFresh: true, runId: 'run-1' }),
          ['--run-migrations', ...flags, '--start-fresh', '--run-id=run-1']
        );

        expectInit();
        expect(output.log).not.toHaveBeenCalledWith(
          expect.objectContaining({
            title: expect.stringContaining('Running migrations from'),
          })
        );
      }
    );
  });

  it.each<[string, string, () => void, string]>([
    [
      'a migration id is not shell-safe',
      'rename files',
      () =>
        mockResolveAgentic.mockResolvedValue({
          kind: 'enabled',
          selectedAgent: {
            id: 'claude-code',
            displayName: 'Claude Code',
            binary: '/usr/local/bin/claude',
            source: 'path',
          },
        }),
      'Apply each prompt yourself.',
    ],
    [
      'the run loaded the WASM build',
      'prompt',
      () => {
        wasm.active = true;
        mockResolveAgentic.mockResolvedValue({
          kind: 'enabled',
          selectedAgent: {
            id: 'claude-code',
            displayName: 'Claude Code',
            binary: '/usr/local/bin/claude',
            source: 'path',
          },
        });
      },
      'Apply each prompt yourself.',
    ],
    [
      'the agentic flow is off',
      'prompt',
      () => {},
      'Re-run with --agentic to apply them.',
    ],
  ])(
    'points a run of prompt-only migrations that applied none at the way to apply them when %s',
    async (_label, name, arrange, remediation) => {
      mockIsInsideAgent.mockReturnValue(false);
      writeFileSync(
        join(root, 'migrations.json'),
        JSON.stringify({
          migrations: [
            { package: '@nx/js', name, version: '1.0.0', prompt: './p.md' },
          ],
        })
      );
      arrange();

      await migrate(root, runMigrationsArgs(), ['--run-migrations']);

      expect(mockRunMasterSession).not.toHaveBeenCalled();
      expect(output.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          title: expect.stringContaining(
            `every entry is a prompt-only migration. ${remediation}`
          ),
        })
      );
    }
  );

  describe('classic loop with an active orchestrated run', () => {
    const activeFacts: ExistingRunFacts = {
      runId: 'run-1',
      createdAt: '2026-01-01T00:00:00.000Z',
      recordedBranch: 'feat/migrate',
      currentBranch: 'feat/migrate',
      progress: {
        applied: 1,
        adopted: 0,
        skipped: 0,
        unresolved: [],
        remaining: 2,
        stalled: 0,
      },
      unresolvedIssues: 0,
      policy: { createCommits: true, skipInstall: false },
      commits: { recorded: 0, reachable: 0, unchecked: 0, newest: null },
      liveWorkers: [],
      otherHolders: [],
      otherActiveRuns: [],
      appliedStillPlanned: 1,
    };
    const continueCommand =
      'npx nx migrate --run-migrations --agentic --run-id=run-1 --create-commits';
    const ranThePlan = expect.objectContaining({
      title: "Running migrations from 'migrations.json'",
    });

    beforeEach(() => {
      mockIsInsideAgent.mockReturnValue(false);
      mockActiveRunForClassic.mockReturnValue({
        runId: 'run-1',
        facts: activeFacts,
      });
    });

    it.each<[string, Record<string, unknown>, string[], () => void, string]>([
      [
        'an AI agent runs nx with --agentic=false, echoing it on the start-fresh command',
        { agentic: false },
        ['--agentic=false'],
        () => {
          mockIsInsideAgent.mockReturnValue(true);
        },
        'npx nx migrate --run-migrations --agentic=false --start-fresh --run-id=run-1',
      ],
      [
        'the terminal cannot prompt',
        {},
        [],
        () => {
          mockCanPrompt.mockReturnValue(false);
        },
        'npx nx migrate --run-migrations --start-fresh --run-id=run-1',
      ],
      [
        'another process holds the run',
        {},
        [],
        () => {
          mockActiveRunForClassic.mockReturnValue({
            runId: 'run-1',
            facts: { ...activeFacts, otherHolders: [4242] },
          });
        },
        'npx nx migrate --run-migrations --start-fresh --run-id=run-1',
      ],
    ])(
      'reports the run with both commands and exits 1 without asking when %s',
      async (_label, overrides, flags, arrange, startFreshCommand) => {
        arrange();

        expect(
          await migrate(root, runMigrationsArgs(overrides), [
            '--run-migrations',
            ...flags,
          ])
        ).toBe(1);

        expect(mockActiveRunForClassic).toHaveBeenCalledWith(root, [
          '@nx/js:gen',
        ]);
        expect(output.warn).toHaveBeenCalledWith({
          title: 'A migrate run is already active: run-1',
          bodyLines: expect.arrayContaining([
            `To continue the run: ${continueCommand}`,
            `To start fresh (deletes the run record, then runs the whole plan again): ${startFreshCommand}`,
          ]),
        });
        expect(output.warn).not.toHaveBeenCalledWith(
          expect.objectContaining({
            bodyLines: expect.arrayContaining([
              expect.stringContaining('The WASM build'),
            ]),
          })
        );
        expect(mockReportRunStopped).toHaveBeenCalledWith('existing_run');
        expect(mockMigrateChoice).not.toHaveBeenCalled();
        expect(mockDeleteRunForStartFresh).not.toHaveBeenCalled();
        expect(output.log).not.toHaveBeenCalledWith(ranThePlan);
      }
    );

    it('tells a WASM run, which refuses both commands, how to get past the run', async () => {
      wasm.active = true;
      mockActiveRunForClassic.mockReturnValue({
        runId: 'run-1',
        facts: { ...activeFacts, otherHolders: 'unknown' },
      });

      expect(
        await migrate(root, runMigrationsArgs(), ['--run-migrations'])
      ).toBe(1);

      expect(output.warn).toHaveBeenCalledWith({
        title: 'A migrate run is already active: run-1',
        bodyLines: expect.arrayContaining([
          `To continue the run: ${continueCommand}`,
          'The WASM build can run neither command. Continue the run with the native nx binary, or make sure no nx migrate process is acting on it, remove .nx/migrate-runs/run-1, then run the plan again.',
        ]),
      });
      expect(mockMigrateChoice).not.toHaveBeenCalled();
      expect(output.log).not.toHaveBeenCalledWith(ranThePlan);
    });

    it('shows the report on a terminal and leaves the run alone when the user aborts', async () => {
      mockMigrateChoice.mockResolvedValue('abort');

      expect(
        await migrate(root, runMigrationsArgs(), ['--run-migrations'])
      ).toBe(0);

      expect(output.log).toHaveBeenCalledWith({
        title: 'A migrate run is already active: run-1',
        bodyLines: expect.not.arrayContaining([
          expect.stringContaining('To continue the run'),
        ]),
      });
      expect(mockMigrateChoice).toHaveBeenCalledWith({
        message: 'What do you want to do with the active migrate run?',
        choices: [
          expect.objectContaining({ value: 'start-fresh' }),
          expect.objectContaining({ value: 'abort' }),
        ],
      });
      expect(output.log).toHaveBeenCalledWith({
        title: `Leaving migrate run run-1 as it is. To continue it with an agent, run ${continueCommand}.`,
      });
      expect(mockReportRunStopped).toHaveBeenCalledWith('aborted');
      expect(mockDeleteRunForStartFresh).not.toHaveBeenCalled();
      expect(output.log).not.toHaveBeenCalledWith(ranThePlan);
    });

    it('deletes the run record and runs the plan when the user starts fresh', async () => {
      mockMigrateChoice.mockResolvedValue('start-fresh');

      // The classic loop runs real migration execution, which fails on this
      // fixture; only the dispatch itself is under test.
      await migrate(root, runMigrationsArgs(), ['--run-migrations']).catch(
        () => {}
      );

      expect(mockDeleteRunForStartFresh).toHaveBeenCalledWith(root, 'run-1');
      expect(output.log).toHaveBeenCalledWith(ranThePlan);
      expect(mockReportRunStopped).not.toHaveBeenCalled();
    });

    it.each<[string, Record<string, unknown>, string[], () => void]>([
      [
        '--agentic=false keeps a terminal run off the agentic flow',
        { agentic: false },
        ['--agentic=false'],
        () => {},
      ],
      [
        'the outer agent runs nx in CI',
        {},
        [],
        () => {
          mockIsInsideAgent.mockReturnValue(true);
          mockIsCI.mockReturnValue(true);
        },
      ],
    ])(
      'replaces the run --start-fresh --run-id names without asking when %s',
      async (_label, overrides, flags, arrange) => {
        arrange();

        await migrate(
          root,
          runMigrationsArgs({ ...overrides, startFresh: true, runId: 'run-1' }),
          ['--run-migrations', ...flags, '--start-fresh', '--run-id=run-1']
        ).catch(() => {});

        expect(mockDeleteRunForStartFresh).toHaveBeenCalledWith(root, 'run-1');
        expect(mockMigrateChoice).not.toHaveBeenCalled();
        expect(mockRunOrchestratorInit).not.toHaveBeenCalled();
        expect(output.log).toHaveBeenCalledWith(ranThePlan);
      }
    );

    it('refuses --start-fresh when the run it names completed after the preflight check', async () => {
      mockActiveRunForClassic.mockReturnValue(null);
      mockCheckRunForStartFresh.mockImplementation(() => {
        throw new Error('nothing to replace');
      });

      expect(
        await migrate(
          root,
          runMigrationsArgs({
            agentic: false,
            startFresh: true,
            runId: 'run-1',
          }),
          [
            '--run-migrations',
            '--agentic=false',
            '--start-fresh',
            '--run-id=run-1',
          ]
        )
      ).toBe(1);

      expect(mockCheckRunForStartFresh).toHaveBeenCalledWith(root, 'run-1');
      expect(mockDeleteRunForStartFresh).not.toHaveBeenCalled();
      expect(output.log).not.toHaveBeenCalledWith(ranThePlan);
    });

    describe('on a run recorded on disk', () => {
      const runJson = () => join(runDir(root, 'run-1'), 'run.json');

      beforeEach(() => {
        mockActiveRunForClassic.mockImplementation(activeRunForClassic);
        mockCheckRunForStartFresh.mockImplementation(checkRunForStartFresh);
        mockDeleteRunForStartFresh.mockImplementation(deleteRunForStartFresh);
        writeRunState(runDir(root, 'run-1'), {
          formatVersion: 1,
          runId: 'run-1',
          createdAt: '2026-01-01T00:00:00.000Z',
          nxVersion: '23.0.0',
          status: 'active',
          createCommits: true,
          commitPrefix: 'chore: [nx migration] ',
          rounds: [{ index: 0, planSnapshot: 'plan-0.json' }],
          steps: [],
          commits: [],
          analytics: { startEmitted: true, completeEmitted: false },
        } as MigrateRunState);
        writeFileSync(join(runDir(root, 'run-1'), 'RUNBOOK.md'), '# runbook\n');
        mockGetGitCurrentBranch.mockReturnValue('main');
      });

      it.each<[string, Record<string, unknown>, string[], () => void]>([
        [
          '--start-fresh --run-id names it',
          { startFresh: true, runId: 'run-1' },
          ['--start-fresh', '--run-id=run-1'],
          () => {},
        ],
        [
          'the user chooses to start fresh',
          {},
          [],
          () => {
            mockMigrateChoice.mockResolvedValue('start-fresh');
          },
        ],
      ])(
        'keeps the run when %s and the default-branch commit prompt is declined',
        async (_label, overrides, flags, arrange) => {
          arrange();
          mockMigrateConfirm.mockResolvedValue(false);
          const before = readFileSync(runJson(), 'utf-8');

          await migrate(
            root,
            runMigrationsArgs({ createCommits: true, ...overrides }),
            ['--run-migrations', '--create-commits', ...flags]
          );

          expect(mockMigrateConfirm).toHaveBeenCalledTimes(1);
          expect(readFileSync(runJson(), 'utf-8')).toBe(before);
          expect(readdirSync(runDir(root, 'run-1'))).toEqual(
            expect.arrayContaining(['RUNBOOK.md', 'plan-0.json'])
          );
          expect(mockReportRunStopped).toHaveBeenCalledWith('declined_commits');
          expect(output.log).not.toHaveBeenCalledWith(
            expect.objectContaining({
              title: expect.stringContaining('Running migrations from'),
            })
          );
        }
      );

      it('refuses --start-fresh over a run another process holds before asking about commits', async () => {
        mkdirSync(join(runDir(root, 'run-1'), 'activity'));
        const holder = new FileLock(
          join(runDir(root, 'run-1'), 'activity', '4242-beef.lock')
        );
        holder.lock();
        try {
          expect(
            await migrate(
              root,
              runMigrationsArgs({
                createCommits: true,
                startFresh: true,
                runId: 'run-1',
              }),
              [
                '--run-migrations',
                '--create-commits',
                '--start-fresh',
                '--run-id=run-1',
              ]
            )
          ).toBe(1);
        } finally {
          holder.unlock();
        }

        expect(output.error).toHaveBeenCalledWith(
          expect.objectContaining({
            title: expect.stringContaining(
              "Not deleting migrate run 'run-1': process 4242 is still working on it"
            ),
          })
        );
        expect(mockMigrateConfirm).not.toHaveBeenCalled();
        expect(readFileSync(runJson(), 'utf-8')).toContain('"run-1"');
      });
    });
  });

  it('reports the stop when the default-branch confirmation of the classic loop is declined', async () => {
    mockIsInsideAgent.mockReturnValue(false);
    mockGetGitCurrentBranch.mockReturnValue('main');
    mockMigrateConfirm.mockResolvedValue(false);

    await migrate(root, runMigrationsArgs({ createCommits: true }), [
      '--run-migrations',
      '--create-commits',
    ]);

    expect(mockReportRunStopped).toHaveBeenCalledWith('declined_commits');
    expect(output.log).not.toHaveBeenCalledWith(
      expect.objectContaining({
        title: expect.stringContaining('Running migrations from'),
      })
    );
  });

  describe('user-initiated run with the agentic flow enabled', () => {
    const selectedAgent = {
      id: 'claude-code',
      displayName: 'Claude Code',
      binary: '/usr/local/bin/claude',
      source: 'path',
    };

    beforeEach(() => {
      mockIsInsideAgent.mockReturnValue(false);
      mockResolveAgentic.mockResolvedValue({
        kind: 'enabled',
        selectedAgent,
      });
    });

    it('hands the run and the default-branch confirmation to the master session', async () => {
      mockGetGitCurrentBranch.mockReturnValue('main');

      await migrate(root, runMigrationsArgs({ agentic: 'claude-code' }), [
        '--run-migrations',
        '--agentic=claude-code',
      ]);

      expect(mockReportRunStart).toHaveBeenCalledTimes(1);
      expect(mockRunOrchestratorInit).not.toHaveBeenCalled();
      expect(mockRunMasterSession).toHaveBeenCalledTimes(1);
      expect(mockRunMasterSession).toHaveBeenCalledWith({
        root,
        migrationsJson: expect.objectContaining({
          migrations: expect.any(Array),
        }),
        migrationsPath: 'migrations.json',
        createCommits: true,
        commitPrefix: expect.any(String),
        skipInstall: false,
        installedNxVersion: '23.0.0',
        validate: undefined,
        finalValidation: undefined,
        agent: selectedAgent,
        interactive: undefined,
        runId: undefined,
        startFresh: undefined,
        confirmStart: expect.any(Function),
      });
      // Asked by init once it is about to start a run, never up front.
      expect(mockMigrateConfirm).not.toHaveBeenCalled();
      const { confirmStart } = mockRunMasterSession.mock.calls[0][0];
      expect(await confirmStart()).toBe(true);
      expect(mockMigrateConfirm).toHaveBeenCalledTimes(1);
      expect(output.log).not.toHaveBeenCalledWith(
        expect.objectContaining({
          title: expect.stringContaining('Running migrations from'),
        })
      );
    });

    it('hands the run a start-fresh replaces to the master session', async () => {
      await migrate(
        root,
        runMigrationsArgs({
          agentic: 'claude-code',
          startFresh: true,
          runId: 'run-1',
        }),
        [
          '--run-migrations',
          '--agentic=claude-code',
          '--start-fresh',
          '--run-id=run-1',
        ]
      );

      expect(mockRunMasterSession).toHaveBeenCalledWith(
        expect.objectContaining({ runId: 'run-1', startFresh: true })
      );
    });

    it('refuses the start when the default-branch confirmation is declined', async () => {
      mockGetGitCurrentBranch.mockReturnValue('main');
      mockMigrateConfirm.mockResolvedValue(false);

      await migrate(root, runMigrationsArgs({ agentic: 'claude-code' }), [
        '--run-migrations',
        '--agentic=claude-code',
      ]);

      expect(mockRunMasterSession).toHaveBeenCalledTimes(1);
      const { confirmStart } = mockRunMasterSession.mock.calls[0][0];
      expect(await confirmStart()).toBe(false);
      expect(mockRunOrchestratorInit).not.toHaveBeenCalled();
      expect(output.log).not.toHaveBeenCalledWith(
        expect.objectContaining({
          title: expect.stringContaining('Running migrations from'),
        })
      );
    });

    it('runs the classic loop without the agent under WASM, where the broker cannot tell a dead session from a slow one', async () => {
      wasm.active = true;

      // The classic loop runs real migration execution, which fails on this
      // fixture; only the dispatch itself is under test.
      await migrate(root, runMigrationsArgs({ agentic: 'claude-code' }), [
        '--run-migrations',
        '--agentic=claude-code',
      ]).catch(() => {});

      expect(mockRunMasterSession).not.toHaveBeenCalled();
      expect(mockRunOrchestratorInit).not.toHaveBeenCalled();
      expect(output.warn).toHaveBeenCalledWith({
        title:
          'Skipping the agentic flow: it needs the native nx binary, and this run loaded the WASM build.',
        bodyLines: ['Continuing the migration without the agentic flow.'],
      });
      // An enabled agent would have turned per-migration commits on.
      expect(output.log).toHaveBeenCalledWith({
        title: "Running migrations from 'migrations.json'",
      });
    });
  });

  it.each<
    [string, 'validate' | 'finalValidation', boolean | undefined, string[]]
  >([
    [
      'forwards --validate=false to the run',
      'validate',
      false,
      ['--no-validate'],
    ],
    [
      'leaves the validation policy unset when the flag is omitted',
      'validate',
      undefined,
      [],
    ],
    [
      'forwards --final-validation=false to the run',
      'finalValidation',
      false,
      ['--no-final-validation'],
    ],
  ])('%s', async (_label, option, value, extraArgs) => {
    await migrate(root, runMigrationsArgs({ [option]: value }), [
      '--run-migrations',
      ...extraArgs,
    ]);

    // Raw flag value on purpose: the run records the resolved policy itself.
    expect(mockRunOrchestratorInit.mock.calls[0][0][option]).toBe(value);
  });
});
