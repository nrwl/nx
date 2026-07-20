// Dispatch-level tests for `migrate()` on the run-phase entry points: commit
// resolution and the default-branch confirmation for the standalone
// single-migration worker, plus run-phase parse-error funnel routing. Kept in
// its own file so the module mocks below don't leak into the main migrate spec.

const mockRunSingleMigrationWorker = jest.fn();
const mockReportRunError = jest.fn();
const mockReportGenerateError = jest.fn();
const mockIsGitRepository = jest.fn();
const mockGetGitCurrentBranch = jest.fn();
const mockGetBaseRef = jest.fn();
const mockCanPrompt = jest.fn();
const mockMigratePrompt = jest.fn();

jest.mock('./run', () => ({
  runSingleMigrationWorker: (...args: unknown[]) =>
    mockRunSingleMigrationWorker(...args),
}));

jest.mock('../../daemon/client/client', () => ({
  daemonClient: {
    stop: jest.fn().mockResolvedValue(undefined),
    enabled: () => false,
    reset: jest.fn(),
  },
}));

jest.mock('./migrate-analytics', () => ({
  ...jest.requireActual('./migrate-analytics'),
  reportMigrateRunError: (...args: unknown[]) => mockReportRunError(...args),
  reportMigrateGenerateError: (...args: unknown[]) =>
    mockReportGenerateError(...args),
}));

jest.mock('../../utils/git-utils', () => ({
  ...jest.requireActual('../../utils/git-utils'),
  isGitRepository: (...args: unknown[]) => mockIsGitRepository(...args),
  getGitCurrentBranch: (...args: unknown[]) => mockGetGitCurrentBranch(...args),
}));

jest.mock('../../utils/command-line-utils', () => ({
  ...jest.requireActual('../../utils/command-line-utils'),
  getBaseRef: (...args: unknown[]) => mockGetBaseRef(...args),
}));

jest.mock('./safe-prompt', () => ({
  ...jest.requireActual('./safe-prompt'),
  canPrompt: (...args: unknown[]) => mockCanPrompt(...args),
  migratePrompt: (...args: unknown[]) => mockMigratePrompt(...args),
}));

const mockReadNxJson = jest.fn();
jest.mock('../../config/configuration', () => ({
  ...jest.requireActual('../../config/configuration'),
  readNxJson: (...args: unknown[]) => mockReadNxJson(...args),
}));

import { output } from '../../utils/output';
import { DEFAULT_MIGRATION_COMMIT_PREFIX } from './command-object';
import { NpmPeerDepsInstallError } from './execute-migration';
import { migrate } from './migrate';

const ROOT = '/virtual-root';

function standaloneArgs(overrides: { [k: string]: unknown } = {}) {
  return {
    runMigration: '@nx/js:gen',
    createCommits: true,
    commitPrefix: DEFAULT_MIGRATION_COMMIT_PREFIX,
    skipInstall: true,
    verbose: false,
    ...overrides,
  };
}

describe('migrate() single-migration dispatch', () => {
  beforeEach(() => {
    mockReadNxJson.mockReset().mockReturnValue({});
    mockRunSingleMigrationWorker.mockReset().mockResolvedValue(undefined);
    mockReportRunError.mockReset();
    mockReportGenerateError.mockReset();
    mockIsGitRepository.mockReset().mockReturnValue(true);
    mockGetGitCurrentBranch.mockReset().mockReturnValue('feature/x');
    mockGetBaseRef.mockReset().mockReturnValue('main');
    mockCanPrompt.mockReset().mockReturnValue(false);
    mockMigratePrompt.mockReset().mockResolvedValue({ proceed: true });
    jest.spyOn(output, 'log').mockImplementation(() => {});
    jest.spyOn(output, 'warn').mockImplementation(() => {});
    jest.spyOn(output, 'error').mockImplementation(() => {});
  });

  afterEach(() => jest.restoreAllMocks());

  describe('commit resolution', () => {
    it('errors and never runs the worker for --create-commits without git', async () => {
      mockIsGitRepository.mockReturnValue(false);

      const exit = await migrate(ROOT, standaloneArgs(), [
        '--run-migration=@nx/js:gen',
        '--create-commits',
      ]);

      expect(exit).toBe(1);
      expect(mockRunSingleMigrationWorker).not.toHaveBeenCalled();
      expect(output.error).toHaveBeenCalled();
    });

    it('passes the resolved effective create-commits flag to the worker', async () => {
      mockIsGitRepository.mockReturnValue(true);
      mockCanPrompt.mockReturnValue(false);

      await migrate(ROOT, standaloneArgs(), ['--run-migration=@nx/js:gen']);

      expect(mockRunSingleMigrationWorker).toHaveBeenCalledTimes(1);
      expect(mockRunSingleMigrationWorker.mock.calls[0][0]).toMatchObject({
        createCommits: true,
      });
    });
  });

  describe('default-branch confirmation', () => {
    it('aborts without running the worker when the user declines on the default branch', async () => {
      mockIsGitRepository.mockReturnValue(true);
      mockCanPrompt.mockReturnValue(true);
      mockGetGitCurrentBranch.mockReturnValue('main');
      mockGetBaseRef.mockReturnValue('main');
      mockMigratePrompt.mockResolvedValue({ proceed: false });

      await migrate(ROOT, standaloneArgs(), ['--run-migration=@nx/js:gen']);

      expect(mockRunSingleMigrationWorker).not.toHaveBeenCalled();
      expect(output.log).toHaveBeenCalledWith(
        expect.objectContaining({
          title: expect.stringContaining('default branch'),
        })
      );
    });

    it('runs the worker when the user confirms on the default branch', async () => {
      mockIsGitRepository.mockReturnValue(true);
      mockCanPrompt.mockReturnValue(true);
      mockGetGitCurrentBranch.mockReturnValue('main');
      mockGetBaseRef.mockReturnValue('main');
      mockMigratePrompt.mockResolvedValue({ proceed: true });

      await migrate(ROOT, standaloneArgs(), ['--run-migration=@nx/js:gen']);

      expect(mockRunSingleMigrationWorker).toHaveBeenCalledTimes(1);
    });

    it('does not prompt when prompting is not possible', async () => {
      mockIsGitRepository.mockReturnValue(true);
      mockCanPrompt.mockReturnValue(false);
      mockGetGitCurrentBranch.mockReturnValue('main');
      mockGetBaseRef.mockReturnValue('main');

      await migrate(ROOT, standaloneArgs(), ['--run-migration=@nx/js:gen']);

      expect(mockMigratePrompt).not.toHaveBeenCalled();
      expect(mockRunSingleMigrationWorker).toHaveBeenCalledTimes(1);
    });
  });

  describe('single-migration parse-error funnel routing', () => {
    it('reports a single-migration parse error through the run funnel, not the generate funnel', async () => {
      // An empty --run-migration fails to parse while `runMigrations` stays
      // undefined, so only the single-migration classification keeps this out
      // of the generate funnel.
      const exit = await migrate(ROOT, { runMigration: '' }, [
        '--run-migration',
      ]);

      expect(exit).toBe(1);
      expect(mockReportRunError).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'other' })
      );
      expect(mockReportGenerateError).not.toHaveBeenCalled();
    });
  });

  describe('single-migration run-error reporting', () => {
    it('reports npm_install and exits without rethrowing when the worker fails on a peer-deps install', async () => {
      mockRunSingleMigrationWorker.mockRejectedValue(
        new NpmPeerDepsInstallError()
      );

      const exit = await migrate(
        ROOT,
        { runMigration: '@nx/js:gen', skipInstall: true },
        ['--run-migration=@nx/js:gen']
      );

      expect(exit).toBe(1);
      expect(mockReportRunError).toHaveBeenCalledTimes(1);
      expect(mockReportRunError).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'npm_install' })
      );
    });

    it('reports other worker failures through the run funnel and still fails', async () => {
      mockRunSingleMigrationWorker.mockRejectedValue(new Error('boom'));

      const exit = await migrate(
        ROOT,
        { runMigration: '@nx/js:gen', skipInstall: true },
        ['--run-migration=@nx/js:gen']
      );

      expect(exit).toBe(1);
      expect(mockReportRunError).toHaveBeenCalledTimes(1);
      expect(mockReportRunError).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'other' })
      );
    });
  });

  describe('nx.json migrate defaults', () => {
    it('applies the commit options but not agentic, and still reaches the worker', async () => {
      // The overlaid custom prefix (without commits enabled) would trip the
      // top-level commit-prefix assert, and an overlaid agentic value would
      // trip the parse conflict; a single-migration invocation must be
      // shielded from both.
      mockReadNxJson.mockReturnValue({
        migrate: { agentic: true, commitPrefix: 'custom: ' },
      });

      await migrate(
        ROOT,
        { runMigration: '@nx/js:gen', skipInstall: true, verbose: false },
        ['--run-migration=@nx/js:gen']
      );

      expect(mockRunSingleMigrationWorker).toHaveBeenCalledTimes(1);
      expect(mockRunSingleMigrationWorker.mock.calls[0][0]).toMatchObject({
        commitPrefix: 'custom: ',
        createCommits: false,
      });
    });
  });
});
