import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { nxVersion } from '../../../utils/versions';
import {
  CURRENT_RUN_STATE_FORMAT_VERSION,
  createRun,
  findActiveRun,
  migrateRunsDir,
  NewerRunStateFormatError,
  readRunState,
  runDir,
  runHandoffsDir,
  writeRunState,
  type MigrateRunState,
} from './run-state';

function buildState(overrides: Partial<MigrateRunState> = {}): MigrateRunState {
  return {
    formatVersion: CURRENT_RUN_STATE_FORMAT_VERSION,
    runId: 'run-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    nxVersion: '99.9.9',
    status: 'active',
    createCommits: true,
    commitPrefix: 'chore: [nx migration] ',
    rounds: [],
    steps: [],
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
            commits: [{ kind: 'bogus', stepIds: [] }] as never,
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

      // The run's install policy decides whether dependency changes are
      // installed; a truthy string must not stand in for it.
      writeFileSync(
        join(dir, 'run.json'),
        JSON.stringify(buildState({ skipInstall: 'yes' as never }))
      );
      expect(() => readRunState(dir)).toThrow(/corrupt run state/i);

      // The clean-retry gate reads the recorded tree state; a string would
      // pass a truthiness check it never gets.
      writeFileSync(
        join(dir, 'run.json'),
        JSON.stringify(
          buildState({
            steps: [{ ...validStep, treeCleanAtDispense: 'clean' }] as never,
          })
        )
      );
      expect(() => readRunState(dir)).toThrow(/corrupt run state/i);
    });

    it('refuses a running step without a pid: nothing would ever reclassify it', () => {
      // Death detection skips a running step with no pid and no step action
      // targets one, so it would stall the run for good.
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
                migrationId: '@nx/js:a',
                status: 'running',
                attempt: 1,
                dispenseCount: 1,
              },
            ] as never,
          })
        )
      );

      expect(() => readRunState(dir)).toThrow(/corrupt run state/i);
    });

    it('refuses a step without a migrationId, the documented format invariant', () => {
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
            migrationId: '@nx/js:a',
            status: 'succeeded',
            attempt: 2,
            dispenseCount: 3,
            pid: 123,
            startedAt: '2026-01-01T00:00:00.000Z',
            finishedAt: '2026-01-01T00:01:00.000Z',
            gitRefBefore: 'ref-before',
            treeCleanAtDispense: true,
            depsHashAtDispense: 'deps-hash',
            outcome: { summary: 'done' },
            promptOutcome: { status: 'completed', summary: 'applied' },
            generatorCompleted: true,
          },
        ],
        commits: [{ kind: 'landed', sha: 'abc', stepIds: ['step-1'] }],
        checkpointFailed: true,
        skipInstall: true,
      });

      writeRunState(dir, state);

      expect(readRunState(dir)).toEqual(state);
    });
  });

  describe('findActiveRun', () => {
    it('returns no active run when there are no runs', () => {
      expect(findActiveRun(root)).toEqual({
        active: null,
        uninterpretable: [],
      });
    });

    it('picks the newest active run, ignoring run-json-less dirs and reporting corrupt ones', () => {
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
      // corrupt run.json: must not crash the scan or win, but must be reported
      mkdirSync(join(migrateRunsDir(root), 'corrupt'), { recursive: true });
      writeFileSync(join(migrateRunsDir(root), 'corrupt', 'run.json'), 'nope');

      const result = findActiveRun(root);

      expect(result.active?.runId).toBe('newer');
      expect(result.active?.state.status).toBe('active');
      expect(result.uninterpretable).toEqual([
        { dirName: 'corrupt', reason: expect.stringContaining('JSON') },
      ]);
    });

    it('reports a run dir whose run.json cannot be read instead of treating it as absent', () => {
      // run.json as a directory makes readFileSync fail with a raw fs error
      // (EISDIR), the same failure class as EACCES on a file.
      mkdirSync(join(migrateRunsDir(root), 'unreadable', 'run.json'), {
        recursive: true,
      });

      const result = findActiveRun(root);

      expect(result.active).toBeNull();
      expect(result.uninterpretable).toEqual([
        { dirName: 'unreadable', reason: expect.stringContaining('EISDIR') },
      ]);
    });

    it('reports an active run dir whose name is not a safe run id instead of resuming it', () => {
      writeRun(
        root,
        'evil;rm -rf',
        buildState({ runId: 'evil;rm -rf', status: 'active' })
      );
      // an unsafe name without a run.json is junk, not a run: stays silent
      mkdirSync(join(migrateRunsDir(root), 'also;unsafe'), { recursive: true });

      const result = findActiveRun(root);

      expect(result.active).toBeNull();
      expect(result.uninterpretable).toEqual([
        { dirName: 'evil;rm -rf', reason: 'its name is not a valid run id' },
      ]);
    });

    it('skips a finished run in an unsafely-named dir: it competes with nothing', () => {
      // Reporting it would refuse every future run with no way for retention
      // to ever clear it, since retention only runs once a run is created.
      writeRun(
        root,
        'evil;rm -rf',
        buildState({ runId: 'evil;rm -rf', status: 'completed' })
      );

      const result = findActiveRun(root);

      expect(result.active).toBeNull();
      expect(result.uninterpretable).toEqual([]);
    });

    it('throws when the migrate-runs dir itself cannot be scanned', () => {
      mkdirSync(dirname(migrateRunsDir(root)), { recursive: true });
      writeFileSync(migrateRunsDir(root), 'not a directory');

      expect(() => findActiveRun(root)).toThrow(/ENOTDIR/);
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

  describe('handoffs subtree', () => {
    it('sits under the run directory rather than beside the state Nx owns', () => {
      // Pinned literally: the agent's write grant is expressed against this
      // path, and the rest of the run directory must stay outside it.
      expect(runHandoffsDir(runDir(root, 'run-1'))).toBe(
        join(migrateRunsDir(root), 'run-1', 'handoffs')
      );
    });

    it('is created with the run so the agent only ever writes a file into it', () => {
      createRun(root, buildState({ runId: 'run-1', status: 'active' }));

      expect(existsSync(runHandoffsDir(runDir(root, 'run-1')))).toBe(true);
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

    it('creates the run even when a stale dir cannot be removed', () => {
      // The run's state is already on disk by then, so aborting here would
      // abort a run that exists, and every retry would abort the same way.
      const dir = migrateRunsDir(root);
      for (let i = 0; i < 6; i++) {
        writeRun(
          root,
          `completed-${i}`,
          buildState({
            runId: `completed-${i}`,
            status: 'completed',
            createdAt: `2026-01-0${i + 1}T00:00:00.000Z`,
          })
        );
      }
      // Read-only leaves the dir readable (so retention still classifies it as
      // stale) while its contents cannot be unlinked.
      const stale = join(dir, 'completed-0');
      chmodSync(stale, 0o500);

      try {
        expect(() =>
          createRun(
            root,
            buildState({
              runId: 'new-run',
              status: 'active',
              createdAt: '2026-03-01T00:00:00.000Z',
            })
          )
        ).not.toThrow();

        expect(readdirSync(dir)).toContain('new-run');
        expect(readdirSync(dir)).toContain('completed-0');
      } finally {
        chmodSync(stale, 0o700);
      }
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
