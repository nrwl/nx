import type { Mock, MockedFunction, MockInstance } from 'vitest';
import { logger } from '@nx/devkit';
import { runLintTasks } from './run-lint-tasks';
import { runOxlint, type OxlintReport } from './run-oxlint';

vi.mock('./run-oxlint', () => ({ runOxlint: vi.fn() }));
vi.mock('@nx/devkit', () => ({ logger: { warn: vi.fn() } }));
vi.mock('@nx/devkit/internal', async () => ({
  ...(await vi.importActual<any>('@nx/devkit/internal')),
  isCI: () => true,
  isAiAgent: () => false,
}));

const mockRunOxlint = runOxlint as MockedFunction<typeof runOxlint>;
const mockLogger = logger as unknown as { warn: Mock };

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
  let stdout: MockInstance;
  beforeEach(() => {
    mockRunOxlint.mockReset();
    mockLogger.warn.mockReset();
    stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
  });
  afterEach(() => stdout.mockRestore());

  it('should spawn once for all tasks and report per task', () => {
    mockRunOxlint.mockReturnValue({
      ok: true,
      report: report([{ filename: 'libs/b/x.ts' }]),
    });

    const results = runLintTasks([task('libs/a'), task('libs/b')], '/ws');

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
      '/ws'
    );

    expect(results['libs/a:lint'].success).toBe(true);
    expect(results['libs/b:lint'].success).toBe(false);
    expect(results['libs/c:lint'].success).toBe(false);
    expect(mockLogger.warn).not.toHaveBeenCalled();
  });

  it('should fail every task with the raw output when Oxlint produces no report', () => {
    mockRunOxlint.mockReturnValue({
      ok: false,
      output: 'Failed to parse oxlint configuration file',
    });

    const results = runLintTasks([task('libs/a'), task('libs/b')], '/ws');

    const failed = expect.objectContaining({
      success: false,
      terminalOutput: 'Failed to parse oxlint configuration file\n',
    });
    expect(results).toEqual({ 'libs/a:lint': failed, 'libs/b:lint': failed });
  });

  it("should ignore a task's nested roots when they are not in the run", () => {
    mockRunOxlint.mockReturnValue({ ok: true, report: report([]) });

    runLintTasks(
      [task('libs/a', { nestedProjectRoots: ['libs/a/nested'] })],
      '/ws'
    );

    expect(mockRunOxlint.mock.calls[0][0]).toEqual([
      '--ignore-pattern=/libs/a/nested',
      '--no-error-on-unmatched-pattern',
      'libs/a',
    ]);
  });

  // Run on its own, each task lints its whole path, so a file two tasks lint
  // fails both, as it does without batching.
  it('should keep an in-run nested root lintable, exclude its own children, and report an overlap in every task', () => {
    mockRunOxlint.mockReturnValue({
      ok: true,
      report: report([{ filename: 'libs/a/nested/x.ts' }]),
    });

    const results = runLintTasks(
      [
        task('libs/a', { nestedProjectRoots: ['libs/a/nested'] }),
        task('libs/a/nested', {
          nestedProjectRoots: ['libs/a/nested/deeper'],
        }),
        task('tools', { lintFilePatterns: ['libs/a/nested/x.ts'] }),
      ],
      '/ws'
    );

    expect(mockRunOxlint.mock.calls[0][0]).toEqual([
      '--ignore-pattern=/libs/a/nested/deeper',
      '--no-error-on-unmatched-pattern',
      'libs/a',
      'libs/a/nested',
      'libs/a/nested/x.ts',
    ]);
    expect(results['libs/a:lint'].success).toBe(true);
    expect(results['libs/a/nested:lint'].success).toBe(false);
    expect(results['tools:lint'].success).toBe(false);
  });

  it("should use the first task's flags and warn when another task differs", () => {
    mockRunOxlint.mockReturnValue({ ok: true, report: report([]) });

    runLintTasks(
      [
        task('libs/a', { config: 'a.json', typeAware: true }),
        task('libs/b', { config: 'b.json', typeAware: true }),
      ],
      '/ws'
    );

    expect(mockRunOxlint.mock.calls[0][0]).toEqual([
      '--config=a.json',
      '--type-aware',
      '--no-error-on-unmatched-pattern',
      'libs/a',
      'libs/b',
    ]);
    expect(mockLogger.warn).toHaveBeenCalledTimes(1);
    expect(mockLogger.warn.mock.calls[0][0]).toContain("libs/a's options");
  });

  it('should not warn when every task resolves the same flags', () => {
    mockRunOxlint.mockReturnValue({ ok: true, report: report([]) });

    runLintTasks(
      [task('libs/a', { fix: true }), task('libs/b', { fix: true })],
      '/ws'
    );

    expect(mockRunOxlint.mock.calls[0][0]).toEqual([
      '--fix',
      '--no-error-on-unmatched-pattern',
      'libs/a',
      'libs/b',
    ]);
    expect(mockLogger.warn).not.toHaveBeenCalled();
  });

  it('should interpolate lintFilePatterns and normalize reported filenames', () => {
    mockRunOxlint.mockReturnValue({
      ok: true,
      report: report([{ filename: 'file:///ws/libs/a/src/x.ts' }]),
    });

    const results = runLintTasks(
      [task('libs/a', { lintFilePatterns: ['{projectRoot}/src'] })],
      '/ws'
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
      '/ws'
    );

    expect(mockRunOxlint.mock.calls[0][0]).not.toContain('--silent');
    expect(results['libs/a:lint']).toMatchObject({
      success: false,
      terminalOutput: '',
    });
    expect(stdout).not.toHaveBeenCalled();
  });
});
