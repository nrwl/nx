import { logger, type ProjectGraph } from '@nx/devkit';
import { runLintTasks } from './run-lint-tasks';
import { runOxlint, type OxlintReport } from './run-oxlint';

jest.mock('./run-oxlint', () => ({ runOxlint: jest.fn() }));
jest.mock('@nx/devkit', () => ({ logger: { warn: jest.fn() } }));
jest.mock('@nx/devkit/internal', () => ({
  ...jest.requireActual('@nx/devkit/internal'),
  isCI: () => true,
  isAiAgent: () => false,
}));

const mockRunOxlint = runOxlint as jest.MockedFunction<typeof runOxlint>;
const mockLogger = logger as unknown as { warn: jest.Mock };

const graph = (roots: string[]): ProjectGraph => ({
  nodes: Object.fromEntries(
    roots.map((root) => [
      root,
      {
        name: root,
        type: 'lib' as const,
        data: { root, targets: { lint: { executor: '@nx/oxlint:lint' } } },
      },
    ])
  ),
  dependencies: {},
});

const report = (
  files: { filename: string; severity?: 'error' | 'warning' }[]
): OxlintReport => ({
  diagnostics: files.map(({ filename, severity = 'error' }) => ({
    filename,
    severity,
    message: 'm',
    code: 'c',
    labels: [{ span: { offset: 0, length: 1, line: 1, column: 1 } }],
  })),
  number_of_files: 3,
  number_of_rules: 1,
  threads_count: 1,
  start_time: 0.01,
});

const task = (root: string, options = {}) => ({
  taskId: `${root}:lint`,
  projectName: root,
  projectRoot: root,
  options,
});

describe('runLintTasks', () => {
  let stdout: jest.SpyInstance;
  beforeEach(() => {
    mockRunOxlint.mockReset();
    mockLogger.warn.mockReset();
    stdout = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
  });
  afterEach(() => stdout.mockRestore());

  it('should spawn once for all tasks and report per task', () => {
    mockRunOxlint.mockReturnValue({
      ok: true,
      report: report([{ filename: 'libs/b/x.ts' }]),
    });

    const results = runLintTasks(
      [task('libs/a'), task('libs/b')],
      '/ws',
      graph(['libs/a', 'libs/b'])
    );

    expect(mockRunOxlint).toHaveBeenCalledTimes(1);
    expect(mockRunOxlint).toHaveBeenCalledWith(
      ['--no-error-on-unmatched-pattern', 'libs/a', 'libs/b'],
      '/ws'
    );
    expect(results['libs/a:lint']).toMatchObject({
      success: true,
      terminalOutput: '',
    });
    expect(results['libs/b:lint'].success).toBe(false);
    expect(results['libs/b:lint'].terminalOutput).toContain('libs/b/x.ts:1:1');
    expect(stdout).toHaveBeenCalledWith(
      'Finished in 10ms on 3 files using 1 threads.\n'
    );
  });

  it('should apply per-task warning thresholds', () => {
    mockRunOxlint.mockReturnValue({
      ok: true,
      report: report([
        { filename: 'libs/a/x.ts', severity: 'warning' },
        { filename: 'libs/b/x.ts', severity: 'warning' },
        { filename: 'libs/c/x.ts', severity: 'warning' },
      ]),
    });

    const results = runLintTasks(
      [
        task('libs/a'),
        task('libs/b', { maxWarnings: 0 }),
        task('libs/c', { denyWarnings: true }),
      ],
      '/ws',
      graph(['libs/a', 'libs/b', 'libs/c'])
    );

    expect(results['libs/a:lint'].success).toBe(true);
    expect(results['libs/b:lint'].success).toBe(false);
    expect(results['libs/c:lint'].success).toBe(false);
  });

  it('should fail every task with the raw output when Oxlint produces no report', () => {
    mockRunOxlint.mockReturnValue({
      ok: false,
      output: 'Failed to parse oxlint configuration file',
    });

    const results = runLintTasks(
      [task('libs/a'), task('libs/b')],
      '/ws',
      graph(['libs/a', 'libs/b'])
    );

    expect(results).toEqual({
      'libs/a:lint': expect.objectContaining({
        success: false,
        terminalOutput: 'Failed to parse oxlint configuration file\n',
      }),
      'libs/b:lint': expect.objectContaining({ success: false }),
    });
  });

  it('should ignore nested projects that are not in the run', () => {
    mockRunOxlint.mockReturnValue({ ok: true, report: report([]) });

    runLintTasks([task('libs/a')], '/ws', graph(['libs/a', 'libs/a/nested']));

    expect(mockRunOxlint.mock.calls[0][0]).toEqual([
      '--ignore-pattern=/libs/a/nested',
      '--no-error-on-unmatched-pattern',
      'libs/a',
    ]);
  });

  it('should merge flags and warn once on a conflicting value', () => {
    mockRunOxlint.mockReturnValue({ ok: true, report: report([]) });

    runLintTasks(
      [
        task('libs/a', { config: 'a.json', typeAware: true }),
        task('libs/b', { config: 'b.json', typeAware: true }),
      ],
      '/ws',
      graph(['libs/a', 'libs/b'])
    );

    expect(mockRunOxlint.mock.calls[0][0]).toEqual([
      '--config=b.json',
      '--type-aware',
      '--no-error-on-unmatched-pattern',
      'libs/a',
      'libs/b',
    ]);
    expect(mockLogger.warn).toHaveBeenCalledTimes(1);
    expect(mockLogger.warn.mock.calls[0][0]).toContain('--config');
  });

  it('should interpolate lintFilePatterns and normalize reported filenames', () => {
    mockRunOxlint.mockReturnValue({
      ok: true,
      report: report([{ filename: 'file:///ws/libs/a/src/x.ts' }]),
    });

    const results = runLintTasks(
      [task('libs/a', { lintFilePatterns: ['{projectRoot}/src'] })],
      '/ws',
      graph(['libs/a'])
    );

    expect(mockRunOxlint.mock.calls[0][0]).toContain('libs/a/src');
    expect(results['libs/a:lint'].success).toBe(false);
    expect(results['libs/a:lint'].terminalOutput).toContain('libs/a/src/x.ts');
  });

  it('should honour --silent on the output only', () => {
    mockRunOxlint.mockReturnValue({
      ok: true,
      report: report([{ filename: 'libs/a/x.ts' }]),
    });

    const results = runLintTasks(
      [task('libs/a', { __unparsed__: ['--silent'] })],
      '/ws',
      graph(['libs/a'])
    );

    expect(mockRunOxlint.mock.calls[0][0]).not.toContain('--silent');
    expect(results['libs/a:lint']).toMatchObject({
      success: false,
      terminalOutput: '',
    });
  });
});
