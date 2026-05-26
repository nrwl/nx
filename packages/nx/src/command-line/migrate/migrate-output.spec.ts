import {
  buildDirectiveBlockBodyLines,
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

      expect(linesLogged()).toContain('Run halted at migration 1 of 3.');
      expect(linesLogged()).toContain(
        '0 migrations completed. 2 not attempted.'
      );
      expect(linesLogged()).toContain(
        'Fix the failing migration and re-run `nx migrate --run-migrations` to resume.'
      );
    });

    it('anchors the "last" line on the most recent applied record with a sha, ignoring deferred work that followed', () => {
      const outcomes: MigrationOutcome[] = [
        { migration: { name: 'a' }, outcome: 'applied', committedSha: 'aaa' },
        { migration: { name: 'b' }, outcome: 'applied', committedSha: 'bbb' },
        { migration: { name: 'c' }, outcome: 'deferred', committedSha: null },
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
        { migration: { name: 'a' }, outcome: 'applied', committedSha: null },
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
        { migration: { name: 'a' }, outcome: 'deferred', committedSha: null },
        { migration: { name: 'b' }, outcome: 'deferred', committedSha: null },
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
        { migration: { name: 'a' }, outcome: 'applied', committedSha: 'aaa' },
        { migration: { name: 'b' }, outcome: 'no-changes', committedSha: null },
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

    it('includes the migration-emitted notes section when present', () => {
      logFailureRecap({
        migrationIndex: 2,
        totalMigrations: 4,
        outcomes: [
          { migration: { name: 'a' }, outcome: 'applied', committedSha: 'aaa' },
        ],
        migrationEmittedNextSteps: ['follow-up step 1', 'follow-up step 2'],
        insideAgent: false,
      });

      expect(linesLogged()).toContain(
        'Notes from migrations that completed before the failure:'
      );
      expect(linesLogged()).toContain('  - follow-up step 1');
      expect(linesLogged()).toContain('  - follow-up step 2');
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
