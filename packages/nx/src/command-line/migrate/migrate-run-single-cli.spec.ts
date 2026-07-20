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

jest.mock('../../config/configuration', () => ({
  ...jest.requireActual('../../config/configuration'),
  readNxJson: () => ({}),
}));

import { output } from '../../utils/output';
import { DEFAULT_MIGRATION_COMMIT_PREFIX } from './command-object';
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

  describe('run-phase parse-error funnel routing', () => {
    it('reports a run-phase parse error through the run funnel, not the generate funnel', async () => {
      const exit = await migrate(
        ROOT,
        { runMigration: 'a', runMigrations: '' },
        ['--run-migration=a', '--run-migrations']
      );

      expect(exit).toBe(1);
      expect(mockReportRunError).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'other' })
      );
      expect(mockReportGenerateError).not.toHaveBeenCalled();
    });
  });
});
