import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { nxVersion } from '../../../utils/versions';
import {
  CURRENT_RUN_STATE_FORMAT_VERSION,
  createRun,
  findActiveRun,
  migrateRunsDir,
  NewerRunStateFormatError,
  readRunState,
  writeRunState,
  type MigrateRunState,
} from './run-state';

function buildState(overrides: Partial<MigrateRunState> = {}): MigrateRunState {
  return {
    formatVersion: CURRENT_RUN_STATE_FORMAT_VERSION,
    runId: 'run-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    nxVersion: '99.9.9',
    mode: 'orchestrated',
    status: 'active',
    createCommits: true,
    commitPrefix: 'chore: [nx migration] ',
    rounds: [],
    steps: [],
    issues: [],
    commits: [],
    analytics: { startEmitted: false, completeEmitted: false },
    ...overrides,
  };
}

function stateWithoutField(field: keyof MigrateRunState): unknown {
  return Object.fromEntries(
    Object.entries(buildState()).filter(([key]) => key !== field)
  );
}

function writeRun(root: string, runId: string, state: MigrateRunState): void {
  const dir = join(migrateRunsDir(root), runId);
  mkdirSync(dir, { recursive: true });
  writeRunState(dir, state);
}

describe('run-state', () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'nx-migrate-run-state-'));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  describe('readRunState / writeRunState', () => {
    it('round-trips a run state through disk', () => {
      const dir = join(root, 'run-1');
      mkdirSync(dir, { recursive: true });
      const state = buildState();

      writeRunState(dir, state);

      expect(readRunState(dir)).toEqual(state);
    });

    it('leaves no stray temp file behind after a write', () => {
      const dir = join(root, 'run-1');
      mkdirSync(dir, { recursive: true });

      writeRunState(dir, buildState());

      expect(readdirSync(dir)).toEqual(['run.json']);
    });

    it('refuses a run state with a newer formatVersion, naming both versions', () => {
      const dir = join(root, 'run-1');
      mkdirSync(dir, { recursive: true });
      writeFileSync(
        join(dir, 'run.json'),
        JSON.stringify(buildState({ formatVersion: 2, nxVersion: '123.4.5' }))
      );

      expect(() => readRunState(dir)).toThrow(/123\.4\.5/);
      expect(() => readRunState(dir)).toThrow(
        new RegExp(nxVersion.replace(/\./g, '\\.'))
      );
    });

    it('refuses a newer formatVersion even when the shape no longer validates', () => {
      // A newer format may change a field's type on purpose; that must read as
      // "newer nx required", not as corruption a caller may swallow as absent.
      const dir = join(root, 'run-1');
      mkdirSync(dir, { recursive: true });
      writeFileSync(
        join(dir, 'run.json'),
        JSON.stringify(buildState({ formatVersion: 2, steps: null as any }))
      );

      expect(() => readRunState(dir)).toThrow(NewerRunStateFormatError);
    });

    it('refuses malformed JSON as a corrupt run state naming the file path', () => {
      const dir = join(root, 'run-1');
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, 'run.json'), '{ not json');

      expect(() => readRunState(dir)).toThrow(/corrupt run state/i);
      expect(() => readRunState(dir)).toThrow(join(dir, 'run.json'));
    });

    it('refuses a run state missing required top-level fields', () => {
      const dir = join(root, 'run-1');
      mkdirSync(dir, { recursive: true });
      writeFileSync(
        join(dir, 'run.json'),
        JSON.stringify(stateWithoutField('steps'))
      );

      expect(() => readRunState(dir)).toThrow(/corrupt run state/i);
    });

    it('refuses a run state whose steps field is present but not an array', () => {
      const dir = join(root, 'run-1');
      mkdirSync(dir, { recursive: true });
      writeFileSync(
        join(dir, 'run.json'),
        JSON.stringify(buildState({ steps: null as never }))
      );

      expect(() => readRunState(dir)).toThrow(/corrupt run state/i);
    });

    it('refuses a run state whose createCommits field has the wrong type', () => {
      const dir = join(root, 'run-1');
      mkdirSync(dir, { recursive: true });
      writeFileSync(
        join(dir, 'run.json'),
        JSON.stringify(buildState({ createCommits: 'yes' as never }))
      );

      expect(() => readRunState(dir)).toThrow(/corrupt run state/i);
    });

    it('refuses invalid array elements instead of surfacing them later as raw TypeErrors', () => {
      const dir = join(root, 'run-1');
      mkdirSync(dir, { recursive: true });
      writeFileSync(
        join(dir, 'run.json'),
        JSON.stringify(buildState({ steps: [null] as never }))
      );

      expect(() => readRunState(dir)).toThrow(/corrupt run state/i);
    });

    it('refuses closed-set values outside the known members', () => {
      const dir = join(root, 'run-1');
      mkdirSync(dir, { recursive: true });
      // 'active ' would otherwise read as neither active nor completed,
      // letting a competing run start on top of this one.
      writeFileSync(
        join(dir, 'run.json'),
        JSON.stringify(buildState({ status: 'active ' as never }))
      );
      expect(() => readRunState(dir)).toThrow(/corrupt run state/i);

      writeFileSync(
        join(dir, 'run.json'),
        JSON.stringify(
          buildState({
            commits: [{ kind: 'bogus', stepIds: [], issueIds: [] }] as never,
          })
        )
      );
      expect(() => readRunState(dir)).toThrow(/corrupt run state/i);
    });

    it('refuses invalid optional fields, nested shapes included', () => {
      const dir = join(root, 'run-1');
      mkdirSync(dir, { recursive: true });
      const validStep = {
        id: 'step-1',
        roundIndex: 0,
        kind: 'migration',
        migrationId: '@nx/js:a',
        status: 'pending',
        attempt: 1,
        dispenseCount: 0,
      };

      // Non-boolean checkpointFailed: truthy strings would silently disable
      // clean retries.
      writeFileSync(
        join(dir, 'run.json'),
        JSON.stringify(buildState({ checkpointFailed: 'yes' as never }))
      );
      expect(() => readRunState(dir)).toThrow(/corrupt run state/i);

      // promptOutcome.status is a closed set too.
      writeFileSync(
        join(dir, 'run.json'),
        JSON.stringify(
          buildState({
            steps: [
              { ...validStep, promptOutcome: { status: 'bogus' } },
            ] as never,
          })
        )
      );
      expect(() => readRunState(dir)).toThrow(/corrupt run state/i);

      // A non-numeric pid would break the death detection's liveness probe.
      writeFileSync(
        join(dir, 'run.json'),
        JSON.stringify(
          buildState({ steps: [{ ...validStep, pid: '123' }] as never })
        )
      );
      expect(() => readRunState(dir)).toThrow(/corrupt run state/i);
    });

    it('refuses a migration step without a migrationId, the documented format invariant', () => {
      const dir = join(root, 'run-1');
      mkdirSync(dir, { recursive: true });
      writeFileSync(
        join(dir, 'run.json'),
        JSON.stringify(
          buildState({
            steps: [
              {
                id: 'step-1',
                roundIndex: 0,
                kind: 'migration',
                status: 'pending',
                attempt: 1,
                dispenseCount: 0,
              },
            ] as never,
          })
        )
      );

      expect(() => readRunState(dir)).toThrow(/corrupt run state/i);
    });

    it('accepts a fully-populated state, optional fields included', () => {
      const dir = join(root, 'run-1');
      mkdirSync(dir, { recursive: true });
      const state = buildState({
        rounds: [{ index: 0, planHash: 'hash', planSnapshot: 'plan-0.json' }],
        steps: [
          {
            id: 'step-1',
            roundIndex: 0,
            kind: 'migration',
            migrationId: '@nx/js:a',
            status: 'succeeded',
            attempt: 2,
            dispenseCount: 3,
            pid: 123,
            startedAt: '2026-01-01T00:00:00.000Z',
            finishedAt: '2026-01-01T00:01:00.000Z',
            gitRefBefore: 'ref-before',
            outcome: { summary: 'done' },
            promptOutcome: { status: 'completed', summary: 'applied' },
            generatorCompleted: true,
          },
        ],
        issues: [
          {
            id: 'issue-1',
            description: 'a problem',
            scope: {},
            recordedBy: 'step-1',
            disposition: 'recorded',
          },
        ],
        commits: [
          { kind: 'landed', sha: 'abc', stepIds: ['step-1'], issueIds: [] },
        ],
        checkpointFailed: true,
      });

      writeRunState(dir, state);

      expect(readRunState(dir)).toEqual(state);
    });
  });

  describe('findActiveRun', () => {
    it('returns null when there are no runs', () => {
      expect(findActiveRun(root)).toBeNull();
    });

    it('picks the newest active run, ignoring run-json-less and corrupt dirs', () => {
      writeRun(
        root,
        'older',
        buildState({
          runId: 'older',
          status: 'active',
          createdAt: '2026-01-01T00:00:00.000Z',
        })
      );
      writeRun(
        root,
        'newer',
        buildState({
          runId: 'newer',
          status: 'active',
          createdAt: '2026-01-02T00:00:00.000Z',
        })
      );
      writeRun(
        root,
        'done',
        buildState({
          runId: 'done',
          status: 'completed',
          createdAt: '2026-01-03T00:00:00.000Z',
        })
      );
      // legacy per-version runner dir: no run.json, must be ignored
      mkdirSync(join(migrateRunsDir(root), 'legacy'), { recursive: true });
      // corrupt run.json: must be ignored, not crash the scan
      mkdirSync(join(migrateRunsDir(root), 'corrupt'), { recursive: true });
      writeFileSync(join(migrateRunsDir(root), 'corrupt', 'run.json'), 'nope');

      const result = findActiveRun(root);

      expect(result?.runId).toBe('newer');
      expect(result?.state.status).toBe('active');
    });

    it('propagates a newer-format run instead of treating it as absent', () => {
      const dir = join(migrateRunsDir(root), 'from-newer-nx');
      mkdirSync(dir, { recursive: true });
      writeFileSync(
        join(dir, 'run.json'),
        JSON.stringify(buildState({ formatVersion: 2, nxVersion: '123.4.5' }))
      );

      expect(() => findActiveRun(root)).toThrow(/123\.4\.5/);
    });
  });

  describe('createRun retention', () => {
    it('keeps the 5 newest completed runs alongside the active, legacy and new-run dirs', () => {
      const dir = migrateRunsDir(root);
      for (let i = 0; i < 7; i++) {
        writeRun(
          root,
          `completed-${i}`,
          buildState({
            runId: `completed-${i}`,
            status: 'completed',
            createdAt: `2026-01-${String(i + 1).padStart(2, '0')}T00:00:00.000Z`,
          })
        );
      }
      writeRun(
        root,
        'active-1',
        buildState({
          runId: 'active-1',
          status: 'active',
          createdAt: '2026-02-01T00:00:00.000Z',
        })
      );
      mkdirSync(join(dir, 'legacy'), { recursive: true });

      createRun(
        root,
        buildState({
          runId: 'new-run',
          status: 'active',
          createdAt: '2026-03-01T00:00:00.000Z',
        })
      );

      expect(readdirSync(dir).sort()).toEqual(
        [
          'active-1',
          'completed-2',
          'completed-3',
          'completed-4',
          'completed-5',
          'completed-6',
          'legacy',
          'new-run',
        ].sort()
      );
    });

    it('leaves newer-format runs alone instead of pruning or crashing', () => {
      const dir = migrateRunsDir(root);
      const newerDir = join(dir, 'from-newer-nx');
      mkdirSync(newerDir, { recursive: true });
      writeFileSync(
        join(newerDir, 'run.json'),
        JSON.stringify(buildState({ formatVersion: 2, nxVersion: '123.4.5' }))
      );

      createRun(
        root,
        buildState({
          runId: 'new-run',
          status: 'active',
          createdAt: '2026-03-01T00:00:00.000Z',
        })
      );

      expect(readdirSync(dir).sort()).toEqual(['from-newer-nx', 'new-run']);
    });
  });
});
