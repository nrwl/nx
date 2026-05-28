import {
  buildDirectiveBlockBodyLines,
  buildRetainedAtSuccessBody,
  buildTallyBodyLine,
  logFailureRecap,
  type MigrationOutcome,
} from './migrate-output';
import { logger } from '../../utils/logger';

describe('migrate-output', () => {
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
        {
          migration: { package: '@test/pkg', name: 'a' },
          outcome: 'applied',
          committedSha: 'aaa',
        },
        {
          migration: { package: '@test/pkg', name: 'b' },
          outcome: 'applied',
          committedSha: 'bbb',
        },
        {
          migration: { package: '@test/pkg', name: 'c' },
          outcome: 'deferred',
          committedSha: null,
        },
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
      const outcomes: MigrationOutcome[] = [
        {
          migration: { package: '@test/pkg', name: 'a' },
          outcome: 'applied',
          committedSha: null,
        },
      ];

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
        {
          migration: { package: '@test/pkg', name: 'a' },
          outcome: 'deferred',
          committedSha: null,
        },
        {
          migration: { package: '@test/pkg', name: 'b' },
          outcome: 'deferred',
          committedSha: null,
        },
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
        {
          migration: { package: '@test/pkg', name: 'a' },
          outcome: 'applied',
          committedSha: 'aaa',
        },
        {
          migration: { package: '@test/pkg', name: 'b' },
          outcome: 'no-changes',
          committedSha: null,
        },
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
        {
          migration: { package: '@test/pkg', name: 'm1' },
          outcome: 'applied',
          committedSha: 'sha1',
        },
        {
          migration: { package: '@test/pkg', name: 'm3' },
          outcome: 'applied',
          committedSha: null,
          committedAsPartOf: { name: 'm4', sha: 'sha4' },
        },
        {
          migration: { package: '@test/pkg', name: 'm4' },
          outcome: 'applied',
          committedSha: 'sha4',
        },
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
        {
          migration: { package: '@test/pkg', name: 'm1' },
          outcome: 'applied',
          committedSha: 'sha1',
        },
        {
          migration: { package: '@test/pkg', name: 'm2' },
          outcome: 'applied',
          committedSha: null,
        },
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
        {
          migration: { package: '@test/pkg', name: 'm1' },
          outcome: 'applied',
          committedSha: 'sha1',
        },
        {
          migration: { package: '@test/pkg', name: 'm2' },
          outcome: 'no-changes',
          committedSha: null,
        },
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
        {
          migration: { package: '@test/pkg', name: 'm1' },
          outcome: 'applied',
          committedSha: 'sha1',
        },
        {
          migration: { package: '@test/pkg', name: 'm2' },
          outcome: 'applied',
          committedSha: null,
          commitFailed: true,
        },
        {
          migration: { package: '@test/pkg', name: 'm3' },
          outcome: 'applied',
          committedSha: null,
          commitFailed: true,
        },
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
        {
          migration: { package: '@test/pkg', name: 'm1' },
          outcome: 'applied',
          committedSha: null,
        },
        {
          migration: { package: '@test/pkg', name: 'm2' },
          outcome: 'applied',
          committedSha: null,
        },
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
        {
          migration: { package: '@test/pkg', name: 'hybrid-mig' },
          outcome: 'deferred',
          committedSha: null,
          commitFailed: true,
        },
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

    it('lists in-flight pendingMigrations entries even when no outcome record exists for them', () => {
      // When the in-flight migration's install throws before its outcome
      // can be pushed, the executor only has it in `pendingMigrations`.
      // The recap must still surface it as retained working-tree state.
      logFailureRecap({
        migrationIndex: 2,
        totalMigrations: 3,
        outcomes: [],
        pendingMigrations: [{ package: '@nx/foo', name: 'in-flight-mig' }],
        migrationEmittedNextSteps: [],
        insideAgent: false,
      });

      const logged = linesLogged();
      expect(logged).toContain(
        'Working-tree state retained from 1 migration whose commits could not be created:'
      );
      expect(logged).toContain('  - @nx/foo: in-flight-mig');
    });

    it('dedupes between outcomes and pendingMigrations entries by package:name', () => {
      // When the in-flight failure also has an outcome record (e.g. it
      // tried a commit then failed before push? Or the executor pushed it
      // before re-raising), we should not list it twice.
      const outcomes: MigrationOutcome[] = [
        {
          migration: { package: '@nx/foo', name: 'shared' },
          outcome: 'applied',
          committedSha: null,
          commitFailed: true,
        },
      ];

      logFailureRecap({
        migrationIndex: 2,
        totalMigrations: 3,
        outcomes,
        pendingMigrations: [{ package: '@nx/foo', name: 'shared' }],
        migrationEmittedNextSteps: [],
        insideAgent: false,
      });

      const logged = linesLogged();
      // Should appear exactly once in the bullet list.
      const bullets = logged.filter((l) => l === '  - @nx/foo: shared');
      expect(bullets).toHaveLength(1);
    });

    it('does not list a migration whose commit failed and was later absorbed', () => {
      // M2's commit failed; M3's commit absorbed M2's diff. The recap
      // anchor points to M3, and M2 is NOT in the uncommitted-state list
      // because its diff did clear (just under a different sha).
      const outcomes: MigrationOutcome[] = [
        {
          migration: { package: '@test/pkg', name: 'm1' },
          outcome: 'applied',
          committedSha: 'sha1',
        },
        {
          migration: { package: '@test/pkg', name: 'm2' },
          outcome: 'applied',
          committedSha: null,
          commitFailed: true,
          committedAsPartOf: { name: 'm3', sha: 'sha3' },
        },
        {
          migration: { package: '@test/pkg', name: 'm3' },
          outcome: 'applied',
          committedSha: 'sha3',
        },
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
        outcomes: [
          {
            migration: { package: '@test/pkg', name: 'a' },
            outcome: 'applied',
            committedSha: 'aaa',
          },
        ],
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
