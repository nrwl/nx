import {
  buildDirectiveBlockBodyLines,
  buildRetainedAtSuccessBody,
  buildTallyBodyLine,
  countLandedCommits,
  logFailureRecap,
  retainedMigrations,
  type CommitState,
  type MigrationOutcome,
  type MigrationOutcomeKind,
} from './migrate-output';
import { logger } from '../../utils/logger';

describe('migrate-output', () => {
  const PKG = '@test/pkg';
  // `applied` covers both the sha-known case (case 1) and the HEAD-resolve
  // race (case 2: commit landed but `git rev-parse HEAD` returned null) via
  // the same `commit: { kind: 'landed', sha }` shape. Pass `null` for sha to
  // model the HEAD-race; pass a string for the normal case.
  const applied = (
    name: string,
    sha: string | null = null,
    pkg: string = PKG
  ): MigrationOutcome => ({
    migration: { package: pkg, name },
    status: 'completed',
    kind: 'applied',
    commit: { kind: 'landed', sha },
  });
  // `appliedNoCommit` models the `--no-create-commits` / no-op-step case:
  // the migration succeeded but no commit was attempted.
  const appliedNoCommit = (
    name: string,
    pkg: string = PKG
  ): MigrationOutcome => ({
    migration: { package: pkg, name },
    status: 'completed',
    kind: 'applied',
    commit: { kind: 'none' },
  });
  const deferred = (
    name: string,
    sha: string | null = null,
    pkg: string = PKG
  ): MigrationOutcome => ({
    migration: { package: pkg, name },
    status: 'completed',
    kind: 'deferred',
    commit: { kind: 'landed', sha },
  });
  const deferredNoCommit = (
    name: string,
    pkg: string = PKG
  ): MigrationOutcome => ({
    migration: { package: pkg, name },
    status: 'completed',
    kind: 'deferred',
    commit: { kind: 'none' },
  });
  const noChanges = (name: string, pkg: string = PKG): MigrationOutcome => ({
    migration: { package: pkg, name },
    status: 'completed',
    kind: 'no-changes',
    commit: { kind: 'none' },
  });
  const failedCommit = (
    name: string,
    kind: MigrationOutcomeKind = 'applied',
    pkg: string = PKG
  ): MigrationOutcome => ({
    migration: { package: pkg, name },
    status: 'completed',
    kind,
    commit: { kind: 'failed' },
  });
  const absorbed = (
    name: string,
    intoName: string,
    intoSha: string | null,
    pkg: string = PKG
  ): MigrationOutcome => ({
    migration: { package: pkg, name },
    status: 'completed',
    kind: 'applied',
    commit: { kind: 'absorbed', into: { name: intoName, sha: intoSha } },
  });
  // `aborted` models a migration that threw mid-loop (the executor's catch
  // block records it with `status: 'aborted'`). The commit state is the
  // disambiguation between "the throw left a diff in the WT" (`failed`) and
  // "the throw left a clean WT" (`none`).
  const aborted = (
    name: string,
    commit: CommitState,
    pkg: string = PKG
  ): MigrationOutcome => ({
    migration: { package: pkg, name },
    status: 'aborted',
    commit,
  });

  describe('buildTallyBodyLine', () => {
    it('returns null when nothing meaningful happened (empty migrations.json)', () => {
      expect(
        buildTallyBodyLine({
          appliedCount: 0,
          committedShasCount: 0,
          skippedPromptsCount: 0,
          insideAgent: false,
        })
      ).toBeNull();
    });

    it('renders only the skipped-prompts segment when nothing was applied but some prompts were skipped', () => {
      expect(
        buildTallyBodyLine({
          appliedCount: 0,
          committedShasCount: 0,
          skippedPromptsCount: 2,
          insideAgent: false,
        })
      ).toBe('2 prompt migrations skipped.');
    });

    it('uses the singular form when exactly one prompt was skipped', () => {
      expect(
        buildTallyBodyLine({
          appliedCount: 0,
          committedShasCount: 0,
          skippedPromptsCount: 1,
          insideAgent: false,
        })
      ).toBe('1 prompt migration skipped.');
    });

    it('uses the "deferred" verb under inside-agent so the outer agent reads it as a directive', () => {
      expect(
        buildTallyBodyLine({
          appliedCount: 0,
          committedShasCount: 0,
          skippedPromptsCount: 2,
          insideAgent: true,
        })
      ).toBe('2 prompt migrations deferred.');
    });

    it('keeps the commits-created segment even at zero so the reader sees applied-but-not-committed runs', () => {
      expect(
        buildTallyBodyLine({
          appliedCount: 3,
          committedShasCount: 0,
          skippedPromptsCount: 0,
          insideAgent: false,
        })
      ).toBe('3 migrations applied, 0 commits created.');
    });

    it('appends the skipped-prompts segment when both applied and skipped are non-zero', () => {
      expect(
        buildTallyBodyLine({
          appliedCount: 2,
          committedShasCount: 2,
          skippedPromptsCount: 1,
          insideAgent: false,
        })
      ).toBe(
        '2 migrations applied, 2 commits created, 1 prompt migration skipped.'
      );
    });

    it('singularizes the applied/commits segments at count 1', () => {
      expect(
        buildTallyBodyLine({
          appliedCount: 1,
          committedShasCount: 1,
          skippedPromptsCount: 0,
          insideAgent: false,
        })
      ).toBe('1 migration applied, 1 commit created.');
    });
  });

  describe('buildRetainedAtSuccessBody', () => {
    it('lists the retained migration names and points the user at `git status` / `git diff`', () => {
      expect(buildRetainedAtSuccessBody(['mig-a', 'mig-b'])).toEqual([
        '  - mig-a',
        '  - mig-b',
        '',
        'Their changes are in the working tree. Inspect with `git status` / `git diff` and either commit them manually or revert.',
      ]);
    });

    it('handles a single name without changing the trailing guidance', () => {
      expect(buildRetainedAtSuccessBody(['only-mig'])).toEqual([
        '  - only-mig',
        '',
        'Their changes are in the working tree. Inspect with `git status` / `git diff` and either commit them manually or revert.',
      ]);
    });
  });

  describe('buildDirectiveBlockBodyLines', () => {
    it('returns an empty array when there are no deferred prompts and no migration notes', () => {
      expect(
        buildDirectiveBlockBodyLines({
          skippedPrompts: [],
          migrationEmittedNextSteps: [],
        })
      ).toEqual([]);
    });

    it('lists deferred prompts with kind hints distinguishing prompt-only from hybrid', () => {
      const lines = buildDirectiveBlockBodyLines({
        skippedPrompts: [
          {
            name: 'prompt-only-mig',
            prompt: 'migrations/prompt-only.md',
          },
          {
            name: 'hybrid-mig',
            prompt: 'migrations/hybrid.md',
            implementation: './hybrid-impl',
          },
        ],
        migrationEmittedNextSteps: [],
      });

      expect(lines).toEqual([
        'Apply the deferred prompts below, in order:',
        '  1. migrations/prompt-only.md',
        '       (prompt-only-mig — prompt-only migration)',
        '  2. migrations/hybrid.md',
        '       (hybrid-mig — hybrid prompt phase)',
        '',
        'Then summarize what was done across the run and commit the changes per workspace conventions.',
      ]);
    });

    it('renders notes-only when no prompts were deferred', () => {
      const lines = buildDirectiveBlockBodyLines({
        skippedPrompts: [],
        migrationEmittedNextSteps: ['Note A', 'Note B'],
      });

      expect(lines).toEqual([
        'Relay these migration-emitted notes to the user:',
        '  - Note A',
        '  - Note B',
        '',
        'Then summarize what was done across the run and commit the changes per workspace conventions.',
      ]);
    });

    it('renders both sections joined by a blank line and switches the trailing summary wording', () => {
      const lines = buildDirectiveBlockBodyLines({
        skippedPrompts: [{ name: 'p1', prompt: 'p1.md' }],
        migrationEmittedNextSteps: ['Note A'],
      });

      expect(lines).toEqual([
        'Apply the deferred prompts below, in order:',
        '  1. p1.md',
        '       (p1 — prompt-only migration)',
        '',
        'Then relay these migration-emitted notes to the user:',
        '  - Note A',
        '',
        'Finally, summarize what was done across the run and commit the changes per workspace conventions.',
      ]);
    });
  });

  describe('countLandedCommits', () => {
    it('counts landed commits including the HEAD-resolve-race case (sha: null)', () => {
      // The HEAD-race outcome (M2: kind=landed, sha=null) was the
      // pre-refactor undercount bug — the old `outcomes.filter(o => o.committedSha)`
      // filter dropped it. The union encoding makes "the commit landed,
      // sha or not" a single tag, so the count is correct by construction.
      const outcomes: MigrationOutcome[] = [
        applied('m1', 'sha1'),
        applied('m2', null),
        appliedNoCommit('m3'),
        failedCommit('m4'),
        absorbed('m5', 'm6', 'sha6'),
        applied('m6', 'sha6'),
      ];

      expect(countLandedCommits(outcomes)).toBe(3);
    });

    it('does not double-count absorbed predecessors (the absorbing commit is the only landed record for the group)', () => {
      const outcomes: MigrationOutcome[] = [
        absorbed('m1', 'm2', 'sha2'),
        absorbed('m1-bis', 'm2', 'sha2'),
        applied('m2', 'sha2'),
      ];

      expect(countLandedCommits(outcomes)).toBe(1);
    });

    it('returns 0 when no commits landed', () => {
      const outcomes: MigrationOutcome[] = [
        appliedNoCommit('m1'),
        failedCommit('m2'),
        aborted('m3', { kind: 'failed' }),
      ];

      expect(countLandedCommits(outcomes)).toBe(0);
    });
  });

  describe('retainedMigrations', () => {
    it('returns only outcomes whose own commit failed and was not absorbed', () => {
      const outcomes: MigrationOutcome[] = [
        applied('m1', 'sha1'),
        failedCommit('m2'),
        absorbed('m3', 'm5', 'sha5'),
        appliedNoCommit('m4'),
        applied('m5', 'sha5'),
        aborted('m6', { kind: 'failed' }, '@nx/foo'),
      ];

      expect(retainedMigrations(outcomes)).toEqual([
        { package: '@test/pkg', name: 'm2' },
        { package: '@nx/foo', name: 'm6' },
      ]);
    });
  });

  describe('logFailureRecap', () => {
    let infoSpy: jest.SpyInstance;
    beforeEach(() => {
      infoSpy = jest.spyOn(logger, 'info').mockImplementation(() => undefined);
    });
    afterEach(() => {
      infoSpy.mockRestore();
    });
    const linesLogged = () =>
      infoSpy.mock.calls.map((args) => (args[0] as string | undefined) ?? '');

    it('renders the zero-completed shape when nothing finished before the failure', () => {
      logFailureRecap({
        migrationIndex: 1,
        totalMigrations: 3,
        outcomes: [],
        migrationEmittedNextSteps: [],
        insideAgent: false,
      });

      expect(linesLogged().join('\n')).toMatchInlineSnapshot(`
        "
        Run halted at migration 1 of 3.
        0 migrations completed. 2 not attempted.

        Fix the failing migration and re-run \`nx migrate --run-migrations\` to resume.
        "
      `);
    });

    it('anchors the "last" line on the most recent applied record with a sha, ignoring deferred work that followed', () => {
      const outcomes: MigrationOutcome[] = [
        applied('a', 'aaa'),
        applied('b', 'bbb'),
        deferredNoCommit('c'),
      ];

      logFailureRecap({
        migrationIndex: 4,
        totalMigrations: 5,
        outcomes,
        migrationEmittedNextSteps: [],
        insideAgent: false,
      });

      expect(linesLogged()).toContain(
        '2 applied (last: b → bbb), 1 deferred. 1 not attempted.'
      );
    });

    it('omits the anchor segment when applied records have no committed sha', () => {
      const outcomes: MigrationOutcome[] = [appliedNoCommit('a')];

      logFailureRecap({
        migrationIndex: 2,
        totalMigrations: 3,
        outcomes,
        migrationEmittedNextSteps: [],
        insideAgent: false,
      });

      expect(linesLogged()).toContain('1 applied. 1 not attempted.');
    });

    it('reports zero applied with the deferred count when only deferred work completed', () => {
      const outcomes: MigrationOutcome[] = [
        deferredNoCommit('a'),
        deferredNoCommit('b'),
      ];

      logFailureRecap({
        migrationIndex: 3,
        totalMigrations: 5,
        outcomes,
        migrationEmittedNextSteps: [],
        insideAgent: false,
      });

      expect(linesLogged()).toContain(
        '0 applied, 2 deferred. 2 not attempted.'
      );
    });

    it('does not count no-changes runs in the anchor walk-back even though they count as applied work', () => {
      const outcomes: MigrationOutcome[] = [
        applied('a', 'aaa'),
        noChanges('b'),
      ];

      logFailureRecap({
        migrationIndex: 3,
        totalMigrations: 4,
        outcomes,
        migrationEmittedNextSteps: [],
        insideAgent: false,
      });

      expect(linesLogged()).toContain(
        '2 applied (last: a → aaa). 1 not attempted.'
      );
    });

    it('uses `committedAsPartOf` as the anchor sha when a migration was absorbed into a later commit', () => {
      // M3's own commit failed; M4's commit absorbed M3's diff and was the
      // most recent applied with anchoring info. The recap reports the sha
      // of the commit that actually contains M3's contribution.
      const outcomes: MigrationOutcome[] = [
        applied('m1', 'sha1'),
        absorbed('m3', 'm4', 'sha4'),
        applied('m4', 'sha4'),
      ];

      logFailureRecap({
        migrationIndex: 5,
        totalMigrations: 6,
        outcomes,
        migrationEmittedNextSteps: [],
        insideAgent: false,
      });

      expect(linesLogged()).toContain(
        '3 applied (last: m4 → sha4). 1 not attempted.'
      );
    });

    it('does not list a migration whose commit landed without a resolvable sha (HEAD-resolve race)', () => {
      // M2's commit landed but `git rev-parse HEAD` raced to null — the diff
      // DID clear from the working tree, so M2 must not appear as
      // "uncommitted". The `commitFailed` flag stays unset (the commit DID
      // land, it just didn't return a sha), which is what excludes M2 from
      // the retained-state filter.
      const outcomes: MigrationOutcome[] = [
        applied('m1', 'sha1'),
        applied('m2'),
      ];

      logFailureRecap({
        migrationIndex: 3,
        totalMigrations: 4,
        outcomes,
        migrationEmittedNextSteps: [],
        insideAgent: false,
      });

      const logged = linesLogged();
      expect(
        logged.some((l) => l.includes('Working-tree state retained from'))
      ).toBe(false);
    });

    it('does not list `no-changes` outcomes as uncommitted-and-retained', () => {
      // A `no-changes` migration produced no diff. Even though it has no sha
      // and no `committedAsPartOf`, there is nothing "retained" in the
      // working tree to surface to the user.
      const outcomes: MigrationOutcome[] = [
        applied('m1', 'sha1'),
        noChanges('m2'),
      ];

      logFailureRecap({
        migrationIndex: 3,
        totalMigrations: 4,
        outcomes,
        migrationEmittedNextSteps: [],
        insideAgent: false,
      });

      const logged = linesLogged();
      expect(
        logged.some((l) => l.includes('Working-tree state retained from'))
      ).toBe(false);
    });

    it('lists migrations whose commits failed and whose diff was not absorbed into any later commit', () => {
      // M2 and M3 ran but their commits failed; no later commit absorbed
      // them (e.g., M4 threw before committing). Their diff sits in the
      // working tree; the recap surfaces them so the user knows what is
      // uncommitted.
      const outcomes: MigrationOutcome[] = [
        applied('m1', 'sha1'),
        failedCommit('m2'),
        failedCommit('m3'),
      ];

      logFailureRecap({
        migrationIndex: 4,
        totalMigrations: 5,
        outcomes,
        migrationEmittedNextSteps: [],
        insideAgent: false,
      });

      expect(linesLogged().join('\n')).toMatchInlineSnapshot(`
        "
        Run halted at migration 4 of 5.
        3 applied (last: m1 → sha1). 1 not attempted.
        See the per-migration log above for full details.

        Working-tree state retained from 2 migrations whose commits could not be created:
          - @test/pkg: m2
          - @test/pkg: m3

        Inspect with \`git status\` / \`git diff\` and either commit them manually or revert before re-running.

        Fix the failing migration and re-run \`nx migrate --run-migrations\` to resume.
        "
      `);
    });

    it('does not list `--no-create-commits` outcomes as commit failures', () => {
      // Commits were intentionally disabled — no commit was attempted, no
      // failure occurred. The recap must not imply that commits "could not
      // be created".
      const outcomes: MigrationOutcome[] = [
        appliedNoCommit('m1'),
        appliedNoCommit('m2'),
      ];

      logFailureRecap({
        migrationIndex: 3,
        totalMigrations: 4,
        outcomes,
        migrationEmittedNextSteps: [],
        insideAgent: false,
      });

      const logged = linesLogged();
      expect(
        logged.some((l) => l.includes('Working-tree state retained from'))
      ).toBe(false);
    });

    it('lists deferred outcomes whose commits failed without being absorbed', () => {
      // Hybrid-without-agentic produces outcome 'deferred' and still calls
      // attemptMigrationCommit on the deterministic phase. If that commit
      // fails and no later commit absorbs the diff, the recap must surface
      // the retained state regardless of the deferred outcome kind.
      const outcomes: MigrationOutcome[] = [
        failedCommit('hybrid-mig', 'deferred'),
      ];

      logFailureRecap({
        migrationIndex: 2,
        totalMigrations: 3,
        outcomes,
        migrationEmittedNextSteps: [],
        insideAgent: false,
      });

      const logged = linesLogged();
      expect(logged).toContain(
        'Working-tree state retained from 1 migration whose commits could not be created:'
      );
      expect(logged).toContain('  - @test/pkg: hybrid-mig');
    });

    it("lists an in-flight migration as retained when the executor records it with `status: 'aborted'`", () => {
      // When the in-flight migration throws before its outcome can be pushed
      // as `completed`, the executor's catch block pushes an `aborted`
      // record with `commit: { kind: 'failed' }` (because the throw left a
      // diff in the working tree). The recap surfaces it as retained state.
      const outcomes: MigrationOutcome[] = [
        aborted('in-flight-mig', { kind: 'failed' }, '@nx/foo'),
      ];

      logFailureRecap({
        migrationIndex: 2,
        totalMigrations: 3,
        outcomes,
        migrationEmittedNextSteps: [],
        insideAgent: false,
      });

      const logged = linesLogged();
      expect(logged).toContain(
        'Working-tree state retained from 1 migration whose commits could not be created:'
      );
      expect(logged).toContain('  - @nx/foo: in-flight-mig');
    });

    it('does not list an aborted in-flight migration when the working tree was clean (commit: none)', () => {
      // The throw escaped before the migration produced any diff. The catch
      // block records `aborted` with `commit: { kind: 'none' }` so the
      // recap correctly omits it from the retained-state section.
      const outcomes: MigrationOutcome[] = [
        aborted('clean-throw', { kind: 'none' }, '@nx/foo'),
      ];

      logFailureRecap({
        migrationIndex: 2,
        totalMigrations: 3,
        outcomes,
        migrationEmittedNextSteps: [],
        insideAgent: false,
      });

      const logged = linesLogged();
      expect(
        logged.some((l) => l.includes('Working-tree state retained from'))
      ).toBe(false);
    });

    it('does not list a migration whose commit failed and was later absorbed', () => {
      // M2's commit failed; M3's commit absorbed M2's diff. The recap
      // anchor points to M3, and M2 is NOT in the uncommitted-state list
      // because its diff did clear (just under a different sha).
      const outcomes: MigrationOutcome[] = [
        applied('m1', 'sha1'),
        absorbed('m2', 'm3', 'sha3'),
        applied('m3', 'sha3'),
      ];

      logFailureRecap({
        migrationIndex: 4,
        totalMigrations: 5,
        outcomes,
        migrationEmittedNextSteps: [],
        insideAgent: false,
      });

      const logged = linesLogged();
      expect(logged).toContain('3 applied (last: m3 → sha3). 1 not attempted.');
      expect(
        logged.some((l) => l.includes('Working-tree state retained from'))
      ).toBe(false);
    });

    it('includes the migration-emitted notes section when present', () => {
      logFailureRecap({
        migrationIndex: 2,
        totalMigrations: 4,
        outcomes: [applied('a', 'aaa')],
        migrationEmittedNextSteps: ['follow-up step 1', 'follow-up step 2'],
        insideAgent: false,
      });

      expect(linesLogged().join('\n')).toMatchInlineSnapshot(`
        "
        Run halted at migration 2 of 4.
        1 applied (last: a → aaa). 2 not attempted.
        See the per-migration log above for full details.

        Notes from migrations that completed before the failure:
          - follow-up step 1
          - follow-up step 2

        Fix the failing migration and re-run \`nx migrate --run-migrations\` to resume.
        "
      `);
    });

    it('emits the inside-agent closing line directing the outer agent to surface the failure', () => {
      logFailureRecap({
        migrationIndex: 1,
        totalMigrations: 2,
        outcomes: [],
        migrationEmittedNextSteps: [],
        insideAgent: true,
      });

      expect(linesLogged()).toContain(
        "Report the failure and the recap above to the user. They'll need to fix the failing migration and re-run `nx migrate --run-migrations` themselves."
      );
    });
  });
});
