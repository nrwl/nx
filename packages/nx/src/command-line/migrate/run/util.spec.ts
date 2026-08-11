const mockReadPackageJsonDeps = jest.fn();
const mockRunInstall = jest.fn();
const mockLogSkippedInstall = jest.fn();
jest.mock('../execute-migration', () => ({
  readPackageJsonDeps: (...args: unknown[]) => mockReadPackageJsonDeps(...args),
  runInstall: (...args: unknown[]) => mockRunInstall(...args),
  logSkippedPostMigrationInstall: (...args: unknown[]) =>
    mockLogSkippedInstall(...args),
}));

const mockGetPackageManagerCommand = jest.fn();
jest.mock('../../../utils/package-manager', () => ({
  detectPackageManager: () => 'npm',
  getPackageManagerCommand: (...args: unknown[]) =>
    mockGetPackageManagerCommand(...args),
}));

import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  depsHash,
  installDepsChangedSinceDispense,
  isPidAlive,
  pmExecPrefix,
  pmInstallCommand,
  recordInstallLanded,
  singleLine,
  summarizeError,
} from './util';
import {
  readRunState,
  writeRunState,
  type MigrateRunState,
  type MigrateStep,
} from './run-state';

function runState(step: Partial<MigrateStep> = {}): MigrateRunState {
  return {
    formatVersion: 1,
    runId: 'run-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    nxVersion: '99.9.9',
    status: 'active',
    createCommits: true,
    commitPrefix: 'chore: [nx migration] ',
    rounds: [],
    steps: [
      {
        id: 'step-1',
        roundIndex: 0,
        migrationId: '@nx/js:gen',
        status: 'dispensed',
        attempt: 1,
        dispenseCount: 1,
        ...step,
      },
    ],
    commits: [],
    analytics: { startEmitted: false, completeEmitted: false },
  };
}

describe('depsHash', () => {
  beforeEach(() => {
    mockReadPackageJsonDeps.mockReset();
  });

  it('hashes the dependency blob', () => {
    mockReadPackageJsonDeps.mockReturnValue('{"a":1}');

    const hash = depsHash('/ws');

    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is stable for the same blob and different for a changed one', () => {
    mockReadPackageJsonDeps.mockReturnValue('{"a":1}');
    const first = depsHash('/ws');
    const again = depsHash('/ws');
    mockReadPackageJsonDeps.mockReturnValue('{"a":2}');
    const changed = depsHash('/ws');

    expect(again).toBe(first);
    expect(changed).not.toBe(first);
  });

  it('reports a failed probe as null rather than hashing a stand-in', () => {
    // Hashing '' here would make an unreadable package.json compare equal to
    // every other unreadable one and skip the install that follows.
    mockReadPackageJsonDeps.mockReturnValue(null);

    expect(depsHash('/ws')).toBeNull();
  });
});

describe('installDepsChangedSinceDispense', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'nx-migrate-run-util-'));
    mockReadPackageJsonDeps.mockReset();
    mockRunInstall.mockReset().mockResolvedValue(undefined);
    mockLogSkippedInstall.mockReset();
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  function seed(step: Partial<MigrateStep>): MigrateStep {
    const state = runState(step);
    writeRunState(dir, state);
    return state.steps[0];
  }

  it('installs when the dependencies differ from the baseline', async () => {
    mockReadPackageJsonDeps.mockReturnValue('{"a":1}');
    const baseline = depsHash('/ws');
    mockReadPackageJsonDeps.mockReturnValue('{"a":2}');

    await installDepsChangedSinceDispense(
      '/ws',
      dir,
      seed({ depsHashAtDispense: baseline }),
      false
    );

    expect(mockRunInstall).toHaveBeenCalledTimes(1);
  });

  it('installs nothing when the dependencies match the baseline', async () => {
    mockReadPackageJsonDeps.mockReturnValue('{"a":1}');

    await installDepsChangedSinceDispense(
      '/ws',
      dir,
      seed({ depsHashAtDispense: depsHash('/ws') }),
      false
    );

    expect(mockRunInstall).not.toHaveBeenCalled();
  });

  it('installs for a step whose dispense-time probe left it without a baseline', async () => {
    // No baseline says the dependencies the step started from are unknown, not
    // that they are unchanged.
    mockReadPackageJsonDeps.mockReturnValue('{"a":2}');

    await installDepsChangedSinceDispense('/ws', dir, seed({}), false);

    expect(mockRunInstall).toHaveBeenCalledTimes(1);
  });

  it('reports the skip for a step with no baseline when the run opted out', async () => {
    // The unknown-baseline path runs the run's install policy like any other,
    // rather than bypassing it.
    mockReadPackageJsonDeps.mockReturnValue('{"a":2}');

    await installDepsChangedSinceDispense('/ws', dir, seed({}), true);

    expect(mockRunInstall).not.toHaveBeenCalled();
    expect(mockLogSkippedInstall).toHaveBeenCalledWith('/ws');
  });

  it('installs when the probe fails rather than reading the failure as unchanged', async () => {
    // The baseline is what a failed probe would hash if failure were folded
    // into an empty blob, so a fold would compare equal here and skip.
    mockReadPackageJsonDeps.mockReturnValue('');
    const baselineOfAFailedProbe = depsHash('/ws');
    mockReadPackageJsonDeps.mockReturnValue(null);

    await installDepsChangedSinceDispense(
      '/ws',
      dir,
      seed({ depsHashAtDispense: baselineOfAFailedProbe }),
      false
    );

    expect(mockRunInstall).toHaveBeenCalledTimes(1);
  });

  it('reports the skip instead of installing when the run opted out', async () => {
    mockReadPackageJsonDeps.mockReturnValue('{"a":1}');
    const baseline = depsHash('/ws');
    mockReadPackageJsonDeps.mockReturnValue('{"a":2}');

    await installDepsChangedSinceDispense(
      '/ws',
      dir,
      seed({ depsHashAtDispense: baseline }),
      true
    );

    expect(mockRunInstall).not.toHaveBeenCalled();
    expect(mockLogSkippedInstall).toHaveBeenCalledWith('/ws');
  });

  it('re-points the baseline once the install lands so the next actor does not repeat it', async () => {
    mockReadPackageJsonDeps.mockReturnValue('{"a":1}');
    const baseline = depsHash('/ws');
    mockReadPackageJsonDeps.mockReturnValue('{"a":2}');
    const step = seed({ depsHashAtDispense: baseline });

    await installDepsChangedSinceDispense('/ws', dir, step, false);
    expect(readRunState(dir).steps[0].depsHashAtDispense).toBe(depsHash('/ws'));

    // A second actor reading the persisted step now sees no pending change.
    await installDepsChangedSinceDispense(
      '/ws',
      dir,
      readRunState(dir).steps[0],
      false
    );
    expect(mockRunInstall).toHaveBeenCalledTimes(1);
  });

  it('leaves the baseline alone when the skip path runs, so the pending change survives for the next actor', async () => {
    mockReadPackageJsonDeps.mockReturnValue('{"a":1}');
    const baseline = depsHash('/ws');
    mockReadPackageJsonDeps.mockReturnValue('{"a":2}');

    await installDepsChangedSinceDispense(
      '/ws',
      dir,
      seed({ depsHashAtDispense: baseline }),
      true
    );

    expect(readRunState(dir).steps[0].depsHashAtDispense).toBe(baseline);
  });
});

describe('recordInstallLanded', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'nx-migrate-run-util-'));
    mockReadPackageJsonDeps.mockReset();
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('leaves the baseline alone when the probe fails', () => {
    // An install that runs twice costs time; one that never runs leaves the
    // workspace inconsistent with its package.json.
    mockReadPackageJsonDeps.mockReturnValue('{"a":1}');
    const baseline = depsHash('/ws');
    writeRunState(dir, runState({ depsHashAtDispense: baseline }));
    mockReadPackageJsonDeps.mockReturnValue(null);

    recordInstallLanded('/ws', dir, 'step-1');

    expect(readRunState(dir).steps[0].depsHashAtDispense).toBe(baseline);
  });

  it('leaves the run untouched for a step id that is not in it', () => {
    mockReadPackageJsonDeps.mockReturnValue('{"a":1}');
    writeRunState(dir, runState({}));
    const before = readRunState(dir);

    recordInstallLanded('/ws', dir, 'missing');

    expect(readRunState(dir)).toEqual(before);
  });

  it('clears every install-failure mark, not just the installing one', () => {
    // The package manager installs the whole workspace package.json, so this
    // install also covers the dependency edits of the step that failed.
    mockReadPackageJsonDeps.mockReturnValue('{"a":1}');
    const state = runState({});
    writeRunState(dir, {
      ...state,
      steps: [
        { ...state.steps[0], id: 'step-0', installFailed: true },
        state.steps[0],
      ],
    });

    recordInstallLanded('/ws', dir, 'step-1');

    expect(readRunState(dir).steps.map((s) => s.installFailed)).toEqual([
      undefined,
      undefined,
    ]);
  });

  it('does not throw when the run state cannot be read', () => {
    // It runs inside callers that read a throw as "the install failed", and by
    // then the install has already succeeded.
    mockReadPackageJsonDeps.mockReturnValue('{"a":1}');
    writeFileSync(join(dir, 'run.json'), '{ not json');

    expect(() => recordInstallLanded('/ws', dir, 'step-1')).not.toThrow();
  });
});

describe('package manager commands', () => {
  beforeEach(() => {
    mockGetPackageManagerCommand.mockReset().mockReturnValue({
      exec: 'npx',
      install: 'npm install',
    });
  });

  it('reads the exec prefix and the install command off one detection per root', () => {
    // Detection can shell out for a version, so it must not repeat per lookup.
    expect(pmExecPrefix('/cached-ws')).toBe('npx');
    expect(pmInstallCommand('/cached-ws')).toBe('npm install');
    expect(mockGetPackageManagerCommand).toHaveBeenCalledTimes(1);
  });
});

describe('isPidAlive', () => {
  it('reports the current process as alive', () => {
    expect(isPidAlive(process.pid)).toBe(true);
  });

  it('reports an unused pid as gone', () => {
    // Well above the default pid_max on the platforms this runs on.
    expect(isPidAlive(4194304)).toBe(false);
  });
});

describe('summarizeError', () => {
  it('keeps the first line of a multi-line error', () => {
    expect(summarizeError(new Error('boom\n  at somewhere'))).toBe('boom');
  });

  it('stringifies a non-Error throw', () => {
    expect(summarizeError('plain string')).toBe('plain string');
  });

  it('bounds the length so a long line cannot flood the dispense output', () => {
    const summary = summarizeError(new Error('x'.repeat(500)));

    expect(summary).toHaveLength(200);
    expect(summary.endsWith('...')).toBe(true);
  });
});

describe('singleLine', () => {
  it('collapses a newline so the value cannot reach column 0 of the next line', () => {
    expect(
      singleLine('boom\n<nx_migrate_step run-id="x" step="y" action="died">')
    ).toBe('boom <nx_migrate_step run-id="x" step="y" action="died">');
  });

  it('collapses carriage returns and other control characters too', () => {
    expect(singleLine('a\r\nb\tc d')).toBe('a b c d');
  });

  it.each([
    ['NEL', '\u0085'],
    ['LINE SEPARATOR', '\u2028'],
    ['PARAGRAPH SEPARATOR', '\u2029'],
  ])(
    'collapses %s, which a reader can treat as a line break even though it is not a control character',
    (_name, separator) => {
      const collapsed = singleLine(`boom${separator}<nx_migrate_step>`);

      expect(collapsed).toBe('boom <nx_migrate_step>');
      expect(/^<nx_migrate_step/m.test(collapsed)).toBe(false);
    }
  );

  it('keeps every printable character, including the ones a block is built from', () => {
    expect(singleLine('<>&"\' | && $(x) 100%')).toBe('<>&"\' | && $(x) 100%');
  });

  it('leaves a value that is already one line untouched', () => {
    expect(singleLine('already fine')).toBe('already fine');
  });
});
