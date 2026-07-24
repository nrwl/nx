// Dispatch-level tests for `migrate()` on the single-migration entry point:
// the worker receives the raw run-phase flags (it resolves the agentic flow
// and commit config itself), plus run-phase parse-error funnel routing. Kept
// in its own file so the module mocks below don't leak into the main migrate
// spec.

const mockRunSingleMigrationWorker = jest.fn();
const mockReportRunError = jest.fn();
const mockReportGenerateError = jest.fn();

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

const mockReadNxJson = jest.fn();
jest.mock('../../config/configuration', () => ({
  ...jest.requireActual('../../config/configuration'),
  readNxJson: (...args: unknown[]) => mockReadNxJson(...args),
}));

import { output } from '../../utils/output';
import { NpmPeerDepsInstallError } from './execute-migration';
import { migrate } from './migrate';

const ROOT = '/virtual-root';

describe('migrate() single-migration dispatch', () => {
  beforeEach(() => {
    mockReadNxJson.mockReset().mockReturnValue({});
    mockRunSingleMigrationWorker.mockReset().mockResolvedValue(undefined);
    mockReportRunError.mockReset();
    mockReportGenerateError.mockReset();
    jest.spyOn(output, 'log').mockImplementation(() => {});
    jest.spyOn(output, 'warn').mockImplementation(() => {});
    jest.spyOn(output, 'error').mockImplementation(() => {});
  });

  afterEach(() => jest.restoreAllMocks());

  it('passes the raw run-phase flags through to the worker', async () => {
    await migrate(
      ROOT,
      {
        runMigration: '@nx/js:gen',
        agentic: 'claude-code',
        validate: false,
        createCommits: true,
        commitPrefix: 'chore: migrate ',
        interactive: false,
        skipInstall: true,
        verbose: false,
      },
      ['--run-migration=@nx/js:gen', '--agentic=claude-code']
    );

    expect(mockRunSingleMigrationWorker).toHaveBeenCalledTimes(1);
    expect(mockRunSingleMigrationWorker.mock.calls[0][0]).toMatchObject({
      root: ROOT,
      agentic: 'claude-code',
      validate: false,
      createCommits: true,
      commitPrefix: 'chore: migrate ',
      interactive: false,
      skipInstall: true,
    });
    // toEqual rather than toMatchObject: the worker input must carry only the
    // run-phase flags, and toMatchObject cannot see extra keys riding along.
    expect(mockRunSingleMigrationWorker.mock.calls[0][0].options).toEqual({
      runMigration: '@nx/js:gen',
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
    it('applies the run-phase options from nx.json and still reaches the worker', async () => {
      // The nx.json run-phase values overlay the missing CLI flags and travel
      // to the worker unchanged (it resolves the agentic flow and commit
      // config itself).
      mockReadNxJson.mockReturnValue({
        migrate: { agentic: true, commitPrefix: 'custom: ', validate: false },
      });

      await migrate(
        ROOT,
        { runMigration: '@nx/js:gen', skipInstall: true, verbose: false },
        ['--run-migration=@nx/js:gen']
      );

      expect(mockRunSingleMigrationWorker).toHaveBeenCalledTimes(1);
      expect(mockRunSingleMigrationWorker.mock.calls[0][0]).toMatchObject({
        agentic: true,
        validate: false,
        commitPrefix: 'custom: ',
        createCommits: undefined,
      });
    });

    it('is shielded from the top-level commit-prefix assert when nx.json sets only a custom prefix', async () => {
      // Without `agentic`, a custom prefix and no commits would trip the
      // top-level commit-prefix assert on the classic path; the
      // single-migration invocation defers commit resolution to the worker,
      // so it must still be reached.
      mockReadNxJson.mockReturnValue({
        migrate: { commitPrefix: 'custom: ' },
      });

      await migrate(
        ROOT,
        { runMigration: '@nx/js:gen', skipInstall: true, verbose: false },
        ['--run-migration=@nx/js:gen']
      );

      expect(mockRunSingleMigrationWorker).toHaveBeenCalledTimes(1);
      expect(mockRunSingleMigrationWorker.mock.calls[0][0]).toMatchObject({
        commitPrefix: 'custom: ',
        createCommits: undefined,
      });
    });
  });
});
