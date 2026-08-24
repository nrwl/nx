// Serve fs from a mutable copy: the read-failure test below spies on the very
// function the archiver calls, which the frozen builtin namespace forbids.
vi.mock('fs', async () => ({ ...require('fs') }));

import * as fs from 'fs';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  applyReportedIssues,
  archiveIssues,
  claimIssuesForStep,
  applicationArchivesIntact,
  issueArchivePath,
  issueFingerprint,
  issueIdsForCommit,
  parseHandoffIssues,
  renderIssueDigestLines,
  renderUnresolvedIssueLines,
  reopenResolutionsForStep,
  settleUnclaimableIssues,
} from './issues';
import { CURRENT_RUN_STATE_FORMAT_VERSION } from './run-state';
import type {
  MigrateRunIssue,
  MigrateRunState,
  MigrateStep,
  MigrateStepStatus,
} from './run-state';

describe('migrate run issues', () => {
  const step = (
    id: string,
    migrationId: string,
    status: MigrateStepStatus
  ): MigrateStep => ({
    id,
    roundIndex: 0,
    migrationId,
    status,
    attempt: 1,
    dispenseCount: status === 'pending' ? 0 : 1,
  });

  const issue = (
    id: string,
    extra: Partial<MigrateRunIssue> = {}
  ): MigrateRunIssue => ({
    id,
    fingerprint: `fp-${id}`,
    summary: `summary of ${id}`,
    reportedByStepId: 'step-1',
    applicableStepIds: ['step-2'],
    disposition: 'recorded',
    ...extra,
  });

  const stateWith = (
    steps: MigrateStep[],
    issues?: MigrateRunIssue[]
  ): MigrateRunState => ({
    formatVersion: 1,
    runId: 'run-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    nxVersion: '1.0.0',
    status: 'active',
    createCommits: false,
    commitPrefix: 'chore: ',
    rounds: [{ index: 0, planHash: 'h', planSnapshot: 'plan-0.json' }],
    steps,
    commits: [],
    ...(issues ? { issues } : {}),
    analytics: { startEmitted: true, completeEmitted: false },
  });

  // step-1 is the reporting step; step-2/step-3 are future work in two
  // packages, one scoped.
  const baseSteps = () => [
    step('step-1', '@nx/js:one', 'awaiting-prompt-outcome'),
    step('step-2', '@nx/js:two', 'pending'),
    step('step-3', 'plain:three', 'pending'),
  ];

  describe('parseHandoffIssues', () => {
    it('parses absent fields as an empty report', () => {
      const result = parseHandoffIssues(
        undefined,
        stateWith(baseSteps()),
        baseSteps()[0]
      );
      expect(result).toEqual({ ok: true, issues: [], updates: [] });
    });

    it.each([
      [
        'a non-array issues field',
        { issues: { summary: 'x' } },
        `"issues" field must be an array`,
      ],
      [
        'an issue entry that is not an object',
        { issues: ['broken'] },
        `"issues"[0] must be an object`,
      ],
      [
        'an issue without a summary',
        { issues: [{ applicableMigrations: 'unknown' }] },
        `non-empty "summary"`,
      ],
      [
        'a summary that normalizes to the empty string',
        { issues: [{ summary: '\u0085', applicableMigrations: 'unknown' }] },
        `non-empty "summary"`,
      ],
      [
        'a summary over the length cap',
        {
          issues: [
            { summary: 'x'.repeat(501), applicableMigrations: 'unknown' },
          ],
        },
        `at most 500 characters`,
      ],
      [
        'a non-string detail',
        {
          issues: [
            { summary: 's', detail: 42, applicableMigrations: 'unknown' },
          ],
        },
        `"detail"`,
      ],
      [
        'an empty applicableMigrations array',
        { issues: [{ summary: 's', applicableMigrations: [] }] },
        `"applicableMigrations"`,
      ],
      [
        'an exact id absent from the plan',
        { issues: [{ summary: 's', applicableMigrations: ['@nx/js:nope'] }] },
        `not in this run's plan`,
      ],
      [
        'a bare package absent from the plan',
        { issues: [{ summary: 's', applicableMigrations: ['other-pkg'] }] },
        `not in this run's plan`,
      ],
      [
        'an unrecognized disposition',
        {
          issues: [
            { summary: 's', applicableMigrations: 'unknown', disposition: 'x' },
          ],
        },
        `"disposition"`,
      ],
      [
        // Two same-fingerprint entries would make array order decide which
        // disposition lands on the ledger.
        'two issues with the same normalized summary',
        {
          issues: [
            { summary: 'same problem', applicableMigrations: 'unknown' },
            {
              summary: '  Same\nProblem ',
              applicableMigrations: 'unknown',
              disposition: 'resolved',
            },
          ],
        },
        `repeats an earlier entry's summary`,
      ],
      [
        // A typoed optional field must reject, not silently fall back to
        // the default disposition.
        'an issue with an unrecognized field',
        {
          issues: [
            {
              summary: 's',
              applicableMigrations: 'unknown',
              dispositon: 'resolved',
            },
          ],
        },
        `unrecognized field "dispositon"`,
      ],
      [
        'a non-array issueUpdates field',
        { issueUpdates: {} },
        `"issueUpdates" field must be an array`,
      ],
      [
        'an update with an unrecognized field',
        {
          issueUpdates: [
            { id: 'issue-1', disposition: 'resolved', notes: 'done' },
          ],
        },
        `unrecognized field "notes"`,
      ],
      [
        'an update for an id nx never recorded',
        { issueUpdates: [{ id: 'issue-9', disposition: 'resolved' }] },
        `not an issue nx has recorded`,
      ],
      [
        'an update disposition of recorded',
        { issueUpdates: [{ id: 'issue-1', disposition: 'recorded' }] },
        `"resolved" or "deferred-final"`,
      ],
      [
        'an update note over the length cap',
        {
          issueUpdates: [
            { id: 'issue-1', disposition: 'resolved', note: 'x'.repeat(1001) },
          ],
        },
        `"note"`,
      ],
      [
        'two updates for the same issue',
        {
          issueUpdates: [
            { id: 'issue-1', disposition: 'resolved' },
            { id: 'issue-1', disposition: 'deferred-final' },
          ],
        },
        `more than once`,
      ],
      [
        // A misspelled report field would otherwise parse as an absent
        // report and be discarded with the folded handoff.
        'a misspelled top-level report field',
        { issueUpates: [{ id: 'issue-1', disposition: 'resolved' }] },
        `unrecognized field "issueUpates"`,
      ],
    ])('rejects %s', (_name, extras, reasonFragment) => {
      const steps = baseSteps();
      const result = parseHandoffIssues(
        extras as Record<string, unknown>,
        stateWith(steps, [issue('issue-1', { claimedByStepId: 'step-1' })]),
        steps[0]
      );
      expect(result.ok).toBe(false);
      expect((result as { ok: false; reason: string }).reason).toContain(
        reasonFragment
      );
    });

    it('rejects an update for an issue assigned to another step', () => {
      const steps = baseSteps();
      const result = parseHandoffIssues(
        { issueUpdates: [{ id: 'issue-1', disposition: 'resolved' }] },
        stateWith(steps, [issue('issue-1', { claimedByStepId: 'step-2' })]),
        steps[0]
      );
      expect(result.ok).toBe(false);
      expect((result as { ok: false; reason: string }).reason).toContain(
        'not assigned to this step'
      );
    });

    it('rejects a handoff that reports and updates the same issue', () => {
      const steps = baseSteps();
      const result = parseHandoffIssues(
        {
          issues: [
            { summary: 'Same  Problem', applicableMigrations: 'unknown' },
          ],
          issueUpdates: [{ id: 'issue-1', disposition: 'resolved' }],
        },
        stateWith(steps, [
          issue('issue-1', {
            fingerprint: issueFingerprint('same problem'),
            summary: 'same problem',
            claimedByStepId: 'step-1',
          }),
        ]),
        steps[0]
      );
      expect(result).toEqual({
        ok: false,
        reason:
          '"issues"[0] describes issue-1, which "issueUpdates" also references; report the problem or update the assignment, not both',
      });
    });

    it('rejects a report over the per-handoff entry caps', () => {
      const steps = baseSteps();
      const result = parseHandoffIssues(
        {
          issues: Array.from({ length: 21 }, (_, i) => ({
            summary: `issue ${i}`,
            applicableMigrations: 'unknown',
          })),
        },
        stateWith(steps),
        steps[0]
      );
      expect(result.ok).toBe(false);
      expect((result as { ok: false; reason: string }).reason).toContain(
        'at most 20'
      );
    });

    it('accepts exact ids, bare package names, and assigned updates, collapsing summaries to one line', () => {
      const steps = baseSteps();
      const result = parseHandoffIssues(
        {
          issues: [
            {
              summary: 'line one\nline two',
              detail: 'multi\nline\ndetail',
              applicableMigrations: ['@nx/js:two', 'plain'],
            },
          ],
          issueUpdates: [
            { id: 'issue-1', disposition: 'resolved', note: 'done' },
          ],
        },
        stateWith(steps, [issue('issue-1', { claimedByStepId: 'step-1' })]),
        steps[0]
      );
      expect(result).toEqual({
        ok: true,
        issues: [
          {
            summary: 'line one line two',
            detail: 'multi\nline\ndetail',
            applicableMigrations: ['@nx/js:two', 'plain'],
          },
        ],
        updates: [{ id: 'issue-1', disposition: 'resolved', note: 'done' }],
      });
    });

    it('tolerates the skipped-outcome marker next to a report', () => {
      const steps = baseSteps();
      const result = parseHandoffIssues(
        {
          outcome: 'skipped',
          issues: [{ summary: 's', applicableMigrations: 'unknown' }],
        },
        stateWith(steps),
        steps[0]
      );
      expect(result.ok).toBe(true);
    });
  });

  describe('issueFingerprint', () => {
    it('collapses case and whitespace variants of the same summary', () => {
      expect(issueFingerprint('The Build  breaks\ton CI')).toBe(
        issueFingerprint('the build breaks on ci')
      );
      expect(issueFingerprint('the build breaks on ci')).not.toBe(
        issueFingerprint('the tests break on ci')
      );
    });
  });

  describe('applyReportedIssues', () => {
    it('assigns sequential ids, maps identifiers to plan steps, and defaults dispositions', () => {
      const steps = baseSteps();
      const result = applyReportedIssues(
        stateWith(steps),
        steps[0],
        [
          { summary: 'future work needed', applicableMigrations: ['plain'] },
          { summary: 'unscoped problem', applicableMigrations: 'unknown' },
        ],
        []
      );
      expect(result.state.issues).toEqual([
        {
          id: 'issue-1',
          fingerprint: issueFingerprint('future work needed'),
          summary: 'future work needed',
          reportedByStepId: 'step-1',
          applicableStepIds: ['step-3'],
          disposition: 'recorded',
        },
        {
          id: 'issue-2',
          fingerprint: issueFingerprint('unscoped problem'),
          summary: 'unscoped problem',
          reportedByStepId: 'step-1',
          applicableStepIds: 'unknown',
          disposition: 'deferred-final',
        },
      ]);
      expect(result.newIssues.map((n) => n.entry.id)).toEqual([
        'issue-1',
        'issue-2',
      ]);
    });

    it('unions and dedups mapped steps across identifiers, keeping plan order', () => {
      const steps = baseSteps();
      const result = applyReportedIssues(
        stateWith(steps),
        steps[0],
        [
          {
            summary: 'wide issue',
            applicableMigrations: ['plain:three', '@nx/js', 'plain'],
          },
        ],
        []
      );
      expect(result.state.issues[0].applicableStepIds).toEqual([
        'step-1',
        'step-2',
        'step-3',
      ]);
    });

    it('allocates past a sparse ledger id instead of minting a duplicate', () => {
      const steps = baseSteps();
      const result = applyReportedIssues(
        stateWith(steps, [issue('issue-2')]),
        steps[0],
        [{ summary: 'new problem', applicableMigrations: ['plain'] }],
        []
      );
      expect(result.state.issues.map((i) => i.id)).toEqual([
        'issue-2',
        'issue-3',
      ]);
    });

    it('restamps an older-format state to the ledger version when it records an issue', () => {
      const steps = baseSteps();
      // The fixture stamps v1; recording an issue puts the state under
      // the ledger's rules, which a downgraded nx must refuse to operate.
      const result = applyReportedIssues(
        stateWith(steps),
        steps[0],
        [{ summary: 'new problem', applicableMigrations: ['plain'] }],
        []
      );
      expect(result.state.formatVersion).toBe(CURRENT_RUN_STATE_FORMAT_VERSION);
    });

    it('refuses to mint an id past the bounded suffix instead of writing an unreadable state', () => {
      const steps = baseSteps();
      // The reader accepts at most 18 digits; minting past a ledger already
      // at the bound would write an id the reader rejects and the archive
      // path cannot name.
      expect(() =>
        applyReportedIssues(
          stateWith(steps, [issue(`issue-${'9'.repeat(18)}`)]),
          steps[0],
          [{ summary: 'new problem', applicableMigrations: ['plain'] }],
          []
        )
      ).toThrow(/cannot allocate/);
    });

    it('keeps allocating distinct ids past the float-precision boundary', () => {
      const steps = baseSteps();
      // A number allocator stalls at 2^53 and would hand both new reports
      // the same id.
      const result = applyReportedIssues(
        stateWith(steps, [issue('issue-9007199254740991')]),
        steps[0],
        [
          { summary: 'first new problem', applicableMigrations: ['plain'] },
          { summary: 'second new problem', applicableMigrations: ['plain'] },
        ],
        []
      );
      expect(result.state.issues.map((i) => i.id)).toEqual([
        'issue-9007199254740991',
        'issue-9007199254740992',
        'issue-9007199254740993',
      ]);
    });

    it('keeps an issue scoped to a re-armable failed step recorded for its retry to claim', () => {
      const steps = [
        step('step-1', '@nx/js:one', 'failed'),
        step('step-2', '@nx/js:two', 'succeeded'),
      ];
      const result = applyReportedIssues(
        stateWith(steps),
        steps[0],
        [{ summary: 'broke here', applicableMigrations: ['@nx/js:one'] }],
        []
      );
      expect(result.state.issues[0].disposition).toBe('recorded');
    });

    it('defers a recorded issue whose applicable steps are all behind the run', () => {
      const steps = [
        step('step-1', '@nx/js:one', 'awaiting-prompt-outcome'),
        step('step-2', '@nx/js:two', 'succeeded'),
      ];
      const result = applyReportedIssues(
        stateWith(steps),
        steps[0],
        [{ summary: 'too late', applicableMigrations: ['@nx/js:two'] }],
        []
      );
      expect(result.state.issues[0].disposition).toBe('deferred-final');
    });

    it('defers an explicitly recorded issue with unknown applicability instead of claiming it speculatively', () => {
      const steps = baseSteps();
      const result = applyReportedIssues(
        stateWith(steps),
        steps[0],
        [
          {
            summary: 'cannot scope this',
            applicableMigrations: 'unknown',
            disposition: 'recorded',
          },
        ],
        []
      );
      expect(result.state.issues[0].disposition).toBe('deferred-final');
    });

    it('records a self-resolved report and hands its id to the commit association', () => {
      const steps = baseSteps();
      const result = applyReportedIssues(
        stateWith(steps),
        steps[0],
        [
          {
            summary: 'found and fixed here',
            applicableMigrations: ['@nx/js:one'],
            disposition: 'resolved',
          },
        ],
        []
      );
      expect(result.state.issues[0].disposition).toBe('resolved');
      expect(result.state.issues[0].resolvedByStepId).toBe('step-1');
      // Stamped at the ledger length, so only later commits can carry it.
      expect(result.state.issues[0].resolvedAtCommitCount).toBe(0);
      expect(issueIdsForCommit(result.state, ['step-1'])).toEqual(['issue-1']);
    });

    it('folds a repeated report into the existing entry instead of duplicating it', () => {
      const steps = baseSteps();
      const existing = issue('issue-1', {
        fingerprint: issueFingerprint('same problem'),
        summary: 'same problem',
      });
      const result = applyReportedIssues(
        stateWith(steps, [existing]),
        steps[0],
        [{ summary: 'Same  Problem', applicableMigrations: ['@nx/js:two'] }],
        []
      );
      expect(result.state.issues).toEqual([existing]);
      expect(result.newIssues).toEqual([]);
    });

    it('lets a repeated report resolve the existing entry when the reporter is its assignee', () => {
      const steps = baseSteps();
      const existing = issue('issue-1', {
        fingerprint: issueFingerprint('same problem'),
        summary: 'same problem',
        claimedByStepId: 'step-1',
      });
      const result = applyReportedIssues(
        stateWith(steps, [existing]),
        steps[0],
        [
          {
            summary: 'same problem',
            applicableMigrations: ['plain'],
            disposition: 'resolved',
          },
        ],
        []
      );
      expect(result.state.issues[0].disposition).toBe('resolved');
      expect(result.state.issues[0].resolvedByStepId).toBe('step-1');
      // The claim dies with the move out of 'recorded'.
      expect(result.state.issues[0].claimedByStepId).toBeUndefined();
      expect(issueIdsForCommit(result.state, ['step-1'])).toEqual(['issue-1']);
      expect(result.updates).toEqual([
        {
          issueId: 'issue-1',
          stepId: 'step-1',
          disposition: 'resolved',
          applicableMigrations: ['plain'],
        },
      ]);
    });

    it('lets a repeated resolved report resolve an unclaimed issue: there is no digest to protect', () => {
      const steps = baseSteps();
      const existing = issue('issue-1', {
        fingerprint: issueFingerprint('same problem'),
        summary: 'same problem',
        applicableStepIds: 'unknown',
        disposition: 'deferred-final',
      });
      const result = applyReportedIssues(
        stateWith(steps, [existing]),
        steps[0],
        [
          {
            summary: 'same problem',
            applicableMigrations: ['@nx/js:one'],
            disposition: 'resolved',
          },
        ],
        []
      );
      expect(result.state.issues[0].disposition).toBe('resolved');
      expect(result.state.issues[0].resolvedByStepId).toBe('step-1');
      expect(issueIdsForCommit(result.state, ['step-1'])).toEqual(['issue-1']);
      expect(result.updates).toEqual([
        {
          issueId: 'issue-1',
          stepId: 'step-1',
          disposition: 'resolved',
          applicableMigrations: ['@nx/js:one'],
        },
      ]);
    });

    it('lets a repeated resolved report resolve a deferred issue despite stale claim residue', () => {
      const steps = baseSteps();
      // States written before claims were stripped on deferral can carry
      // this residue; ownership must not outlive the recorded disposition.
      const existing = issue('issue-1', {
        fingerprint: issueFingerprint('same problem'),
        summary: 'same problem',
        disposition: 'deferred-final',
        claimedByStepId: 'step-2',
      });
      const result = applyReportedIssues(
        stateWith(steps, [existing]),
        steps[0],
        [
          {
            summary: 'same problem',
            applicableMigrations: ['@nx/js:one'],
            disposition: 'resolved',
          },
        ],
        []
      );
      expect(result.state.issues[0].disposition).toBe('resolved');
      expect(result.state.issues[0].resolvedByStepId).toBe('step-1');
      expect(result.state.issues[0].claimedByStepId).toBeUndefined();
    });

    it('re-credits a repeated resolved report and fences the commits that carried the old fix', () => {
      // Resolved issues never appear in the digest, so a duplicate resolved
      // report means the reporter hit the problem again and fixed it.
      const steps = baseSteps();
      const existing = issue('issue-1', {
        fingerprint: issueFingerprint('same problem'),
        summary: 'same problem',
        applicableStepIds: ['step-2'],
        disposition: 'resolved',
        resolvedByStepId: 'step-2',
        resolvedAtCommitCount: 0,
      });
      const state: MigrateRunState = {
        ...stateWith(steps, [existing]),
        commits: [
          {
            kind: 'landed',
            sha: 'abc123',
            stepIds: ['step-2'],
            issueIds: ['issue-1'],
          },
        ],
      };
      const result = applyReportedIssues(
        state,
        steps[0],
        [
          {
            summary: 'same problem',
            applicableMigrations: ['plain'],
            disposition: 'resolved',
            detail: 'reintroduced and fixed again',
          },
        ],
        []
      );
      expect(result.state.issues).toEqual([
        {
          ...existing,
          applicableStepIds: ['step-2', 'step-3'],
          resolvedByStepId: 'step-1',
          resolvedAtCommitCount: 1,
        },
      ]);
      // The old commit no longer vouches; the new fix reaches its own
      // commit.
      expect(issueIdsForCommit(result.state, ['step-1'])).toEqual(['issue-1']);
      expect(result.updates).toEqual([
        {
          issueId: 'issue-1',
          stepId: 'step-1',
          disposition: 'resolved',
          applicableMigrations: ['plain'],
          detail: 'reintroduced and fixed again',
        },
      ]);
    });

    it("routes a repeated report's concrete applicability into an unknown deferred entry, reviving it", () => {
      const steps = baseSteps();
      const existing = issue('issue-1', {
        fingerprint: issueFingerprint('same problem'),
        summary: 'same problem',
        applicableStepIds: 'unknown',
        disposition: 'deferred-final',
      });
      const result = applyReportedIssues(
        stateWith(steps, [existing]),
        steps[0],
        [{ summary: 'same problem', applicableMigrations: ['@nx/js:two'] }],
        []
      );
      expect(result.state.issues).toEqual([
        {
          ...existing,
          applicableStepIds: ['step-2'],
          disposition: 'recorded',
        },
      ]);
      expect(result.updates).toEqual([
        {
          issueId: 'issue-1',
          stepId: 'step-1',
          disposition: 'recorded',
          applicableMigrations: ['@nx/js:two'],
        },
      ]);
    });

    it("keeps a repeated report's explicit deferred-final while widening its scope", () => {
      const steps = baseSteps();
      const existing = issue('issue-1', {
        fingerprint: issueFingerprint('same problem'),
        summary: 'same problem',
        applicableStepIds: 'unknown',
        disposition: 'deferred-final',
      });
      const result = applyReportedIssues(
        stateWith(steps, [existing]),
        steps[0],
        [
          {
            summary: 'same problem',
            applicableMigrations: ['@nx/js:two'],
            disposition: 'deferred-final',
          },
        ],
        []
      );
      // The reporter said no later migration should pick this up; the
      // routing clarification lands without a revival.
      expect(result.state.issues).toEqual([
        { ...existing, applicableStepIds: ['step-2'] },
      ]);
      expect(result.updates).toEqual([
        {
          issueId: 'issue-1',
          stepId: 'step-1',
          disposition: 'deferred-final',
          applicableMigrations: ['@nx/js:two'],
        },
      ]);
    });

    it('reopens a resolved entry when a later report says the problem is back', () => {
      const steps = baseSteps();
      const existing = issue('issue-1', {
        fingerprint: issueFingerprint('same problem'),
        summary: 'same problem',
        applicableStepIds: ['step-2'],
        disposition: 'resolved',
        resolvedByStepId: 'step-1',
        claimedByStepId: 'step-1',
      });
      const result = applyReportedIssues(
        stateWith(steps, [existing]),
        steps[1],
        [{ summary: 'same problem', applicableMigrations: ['plain'] }],
        []
      );
      expect(result.state.issues).toEqual([
        {
          id: 'issue-1',
          fingerprint: issueFingerprint('same problem'),
          summary: 'same problem',
          reportedByStepId: 'step-1',
          applicableStepIds: ['step-2', 'step-3'],
          disposition: 'recorded',
        },
      ]);
      expect(result.updates).toEqual([
        {
          issueId: 'issue-1',
          stepId: 'step-2',
          disposition: 'recorded',
          applicableMigrations: ['plain'],
        },
      ]);
      // The reverted resolution must not reach a later commit's issue ids.
      expect(issueIdsForCommit(result.state, ['step-1'])).toEqual([]);
    });

    it('drops the resolution stamp with the credit when a report reopens the entry', () => {
      const steps = baseSteps();
      const existing = issue('issue-1', {
        fingerprint: issueFingerprint('same problem'),
        summary: 'same problem',
        applicableStepIds: ['step-2'],
        disposition: 'resolved',
        resolvedByStepId: 'step-1',
        resolvedAtCommitCount: 0,
      });
      const state: MigrateRunState = {
        ...stateWith(steps, [existing]),
        commits: [
          {
            kind: 'landed',
            sha: 'abc123',
            stepIds: ['step-1'],
            issueIds: ['issue-1'],
          },
        ],
      };
      const result = applyReportedIssues(
        state,
        steps[1],
        [{ summary: 'same problem', applicableMigrations: 'unknown' }],
        []
      );
      expect(result.state.issues[0].disposition).toBe('recorded');
      expect(result.state.issues[0].resolvedByStepId).toBeUndefined();
      expect(result.state.issues[0].resolvedAtCommitCount).toBeUndefined();
    });

    it("honors a reopening report's explicit deferred-final and archives its detail", () => {
      const steps = baseSteps();
      const existing = issue('issue-1', {
        fingerprint: issueFingerprint('same problem'),
        summary: 'same problem',
        applicableStepIds: ['step-2'],
        disposition: 'resolved',
        resolvedByStepId: 'step-1',
      });
      const result = applyReportedIssues(
        stateWith(steps, [existing]),
        steps[0],
        [
          {
            summary: 'same problem',
            applicableMigrations: 'unknown',
            disposition: 'deferred-final',
            detail: 'regressed after the config rewrite',
          },
        ],
        []
      );
      expect(result.state.issues[0].disposition).toBe('deferred-final');
      expect(result.state.issues[0].resolvedByStepId).toBeUndefined();
      expect(result.updates).toEqual([
        {
          issueId: 'issue-1',
          stepId: 'step-1',
          disposition: 'deferred-final',
          detail: 'regressed after the config rewrite',
        },
      ]);
    });

    it("defers an unclaimed recorded entry on a repeated report's explicit deferred-final", () => {
      const steps = baseSteps();
      const existing = issue('issue-1', {
        fingerprint: issueFingerprint('same problem'),
        summary: 'same problem',
        applicableStepIds: ['step-2'],
      });
      const result = applyReportedIssues(
        stateWith(steps, [existing]),
        steps[0],
        [
          {
            summary: 'same problem',
            applicableMigrations: 'unknown',
            disposition: 'deferred-final',
          },
        ],
        []
      );
      expect(result.state.issues).toEqual([
        { ...existing, disposition: 'deferred-final' },
      ]);
      expect(result.updates).toEqual([
        { issueId: 'issue-1', stepId: 'step-1', disposition: 'deferred-final' },
      ]);
    });

    it("keeps another step's assignment despite a repeated report's deferred-final", () => {
      const steps = baseSteps();
      const existing = issue('issue-1', {
        fingerprint: issueFingerprint('same problem'),
        summary: 'same problem',
        applicableStepIds: ['step-2'],
        claimedByStepId: 'step-2',
      });
      const state = stateWith(steps, [existing]);
      const result = applyReportedIssues(
        state,
        steps[0],
        [
          {
            summary: 'same problem',
            applicableMigrations: 'unknown',
            disposition: 'deferred-final',
          },
        ],
        []
      );
      expect(result.state).toEqual(state);
      expect(result.updates).toEqual([]);
    });

    it("widens a recorded entry's applicability from a repeated report without touching its claim", () => {
      const steps = baseSteps();
      const existing = issue('issue-1', {
        fingerprint: issueFingerprint('same problem'),
        summary: 'same problem',
        applicableStepIds: ['step-2'],
        claimedByStepId: 'step-2',
      });
      const result = applyReportedIssues(
        stateWith(steps, [existing]),
        steps[0],
        [{ summary: 'same problem', applicableMigrations: ['plain'] }],
        []
      );
      expect(result.state.issues).toEqual([
        { ...existing, applicableStepIds: ['step-2', 'step-3'] },
      ]);
      expect(result.updates).toEqual([
        {
          issueId: 'issue-1',
          stepId: 'step-1',
          disposition: 'recorded',
          applicableMigrations: ['plain'],
        },
      ]);
    });

    it('does not read a normalizing merge of duplicated scope as new routing', () => {
      // The persisted boundary rejects duplicated applicability; this pins
      // the in-memory defense for a state that slipped past it anyway.
      const steps = baseSteps();
      const existing = issue('issue-1', {
        fingerprint: issueFingerprint('same problem'),
        summary: 'same problem',
        applicableStepIds: ['step-2', 'step-2'],
        disposition: 'deferred-final',
      });
      const result = applyReportedIssues(
        stateWith(steps, [existing]),
        steps[0],
        [{ summary: 'same problem', applicableMigrations: ['@nx/js:two'] }],
        []
      );
      expect(result.state.issues[0].disposition).toBe('deferred-final');
    });

    it('keeps a deferral when a repeated report adds no new routing', () => {
      const steps = baseSteps();
      const existing = issue('issue-1', {
        fingerprint: issueFingerprint('same problem'),
        summary: 'same problem',
        applicableStepIds: ['step-2'],
        disposition: 'deferred-final',
      });
      const state = stateWith(steps, [existing]);
      const result = applyReportedIssues(
        state,
        steps[0],
        [{ summary: 'same problem', applicableMigrations: 'unknown' }],
        []
      );
      // step-2 could still claim it, but the report brought no new scope;
      // an echo of a digest-visible deferral does not override it.
      expect(result.state).toEqual(state);
      expect(result.updates).toEqual([]);
    });

    it('keeps a deferral when the added routing cannot claim the issue, despite older claimable scope', () => {
      const steps = [
        step('step-1', '@nx/js:one', 'awaiting-prompt-outcome'),
        step('step-2', '@nx/js:two', 'pending'),
        step('step-3', 'plain:three', 'succeeded'),
      ];
      const existing = issue('issue-1', {
        fingerprint: issueFingerprint('same problem'),
        summary: 'same problem',
        applicableStepIds: ['step-2'],
        disposition: 'deferred-final',
      });
      const result = applyReportedIssues(
        stateWith(steps, [existing]),
        steps[0],
        [{ summary: 'same problem', applicableMigrations: ['plain'] }],
        []
      );
      // 'plain' maps only to terminal step-3: new routing, but no new fix
      // opportunity. The deferral already stood over claimable step-2, so
      // reviving on it would let routing to finished work undo it.
      const entry = result.state.issues[0];
      expect(entry.disposition).toBe('deferred-final');
      expect(entry.applicableStepIds).toEqual(['step-2', 'step-3']);
    });

    it("archives a repeated unknown report's new detail without touching the entry", () => {
      const steps = baseSteps();
      const existing = issue('issue-1', {
        fingerprint: issueFingerprint('same problem'),
        summary: 'same problem',
        applicableStepIds: 'unknown',
        disposition: 'deferred-final',
      });
      const state = stateWith(steps, [existing]);
      const result = applyReportedIssues(
        state,
        steps[0],
        [
          {
            summary: 'same problem',
            applicableMigrations: 'unknown',
            detail: 'later diagnostic needed by final validation',
          },
        ],
        []
      );
      // The handoff carrying the detail is removed on fold; the archive
      // record is the only copy that survives.
      expect(result.state).toEqual(state);
      expect(result.updates).toEqual([
        {
          issueId: 'issue-1',
          stepId: 'step-1',
          disposition: 'deferred-final',
          detail: 'later diagnostic needed by final validation',
        },
      ]);
    });

    it('drops the claim when an update defers the issue', () => {
      const steps = baseSteps();
      const result = applyReportedIssues(
        stateWith(steps, [issue('issue-1', { claimedByStepId: 'step-1' })]),
        steps[0],
        [],
        [{ id: 'issue-1', disposition: 'deferred-final' }]
      );
      expect(result.state.issues[0].disposition).toBe('deferred-final');
      expect(result.state.issues[0].claimedByStepId).toBeUndefined();
    });

    it("lets a repeated resolved report through a terminal assignee's stale claim", () => {
      const steps = [
        step('step-1', '@nx/js:one', 'succeeded'),
        step('step-2', '@nx/js:two', 'awaiting-prompt-outcome'),
        step('step-3', 'plain:three', 'pending'),
      ];
      const existing = issue('issue-1', {
        fingerprint: issueFingerprint('same problem'),
        summary: 'same problem',
        applicableStepIds: ['step-1', 'step-3'],
        claimedByStepId: 'step-1',
      });
      const result = applyReportedIssues(
        stateWith(steps, [existing]),
        steps[1],
        [
          {
            summary: 'same problem',
            applicableMigrations: ['@nx/js:two'],
            disposition: 'resolved',
          },
        ],
        []
      );
      // step-1 succeeded without resolving it, so its claim owns nothing;
      // the step that actually fixed the problem gets the resolution.
      expect(result.state.issues[0].disposition).toBe('resolved');
      expect(result.state.issues[0].resolvedByStepId).toBe('step-2');
      expect(result.state.issues[0].claimedByStepId).toBeUndefined();
    });

    it("drops a repeated resolved report for an issue assigned to another step, keeping the assignee's entry", () => {
      const steps = baseSteps();
      const existing = issue('issue-1', {
        fingerprint: issueFingerprint('same problem'),
        summary: 'same problem',
        claimedByStepId: 'step-2',
      });
      const result = applyReportedIssues(
        stateWith(steps, [existing]),
        steps[0],
        [
          {
            summary: 'same problem',
            applicableMigrations: ['plain'],
            disposition: 'resolved',
          },
        ],
        []
      );
      // The resolution is dropped (the assignee owns the entry); only the
      // report's applicability is unioned in.
      expect(result.state.issues).toEqual([
        { ...existing, applicableStepIds: ['step-2', 'step-3'] },
      ]);
      expect(result.updates).toEqual([
        {
          issueId: 'issue-1',
          stepId: 'step-1',
          disposition: 'recorded',
          applicableMigrations: ['plain'],
        },
      ]);
    });

    it('applies updates, attributing only real transitions into resolved to the reporting step', () => {
      const steps = baseSteps();
      const result = applyReportedIssues(
        stateWith(steps, [
          issue('issue-1', { claimedByStepId: 'step-1' }),
          issue('issue-2', {
            fingerprint: 'fp-2',
            claimedByStepId: 'step-1',
            disposition: 'resolved',
          }),
        ]),
        steps[0],
        [],
        [
          { id: 'issue-1', disposition: 'resolved', note: 'fixed it' },
          { id: 'issue-2', disposition: 'resolved' },
        ]
      );
      expect(result.state.issues[0].disposition).toBe('resolved');
      expect(result.state.issues[0].resolvedByStepId).toBe('step-1');
      // The claim dies with the move out of 'recorded'.
      expect(result.state.issues[0].claimedByStepId).toBeUndefined();
      // issue-2 was already resolved, so this handoff gets no credit for it.
      expect(result.state.issues[1].resolvedByStepId).toBeUndefined();
      expect(issueIdsForCommit(result.state, ['step-1'])).toEqual(['issue-1']);
      expect(result.updates).toEqual([
        {
          issueId: 'issue-1',
          stepId: 'step-1',
          disposition: 'resolved',
          note: 'fixed it',
        },
        { issueId: 'issue-2', stepId: 'step-1', disposition: 'resolved' },
      ]);
    });
  });

  describe('issueIdsForCommit', () => {
    it("carries a named step's resolutions that no earlier landed commit already carries", () => {
      const state = {
        ...stateWith(baseSteps(), [
          issue('issue-1', {
            disposition: 'resolved',
            resolvedByStepId: 'step-1',
          }),
          issue('issue-2', {
            fingerprint: 'fp-b',
            disposition: 'resolved',
            resolvedByStepId: 'step-1',
          }),
          issue('issue-3', {
            fingerprint: 'fp-c',
            disposition: 'resolved',
            resolvedByStepId: 'step-3',
          }),
          issue('issue-4', { fingerprint: 'fp-d' }),
        ]),
        commits: [
          {
            kind: 'landed' as const,
            stepIds: ['step-1'],
            issueIds: ['issue-1'],
          },
        ],
      };
      // issue-1 is already carried, issue-3 was resolved by a step the commit
      // does not name, and issue-4 is unresolved.
      expect(issueIdsForCommit(state, ['step-2', 'step-1'])).toEqual([
        'issue-2',
      ]);
    });

    it("carries a reopened issue's new resolution despite the commit that carried the old one", () => {
      // issue-1 was resolved by step-1, carried, reopened, then resolved
      // again by step-3; the old commit names the (issue, step-1) pair, not
      // this resolution.
      const state = {
        ...stateWith(baseSteps(), [
          issue('issue-1', {
            disposition: 'resolved',
            resolvedByStepId: 'step-3',
            resolvedAtCommitCount: 1,
          }),
        ]),
        commits: [
          {
            kind: 'landed' as const,
            stepIds: ['step-1'],
            issueIds: ['issue-1'],
          },
        ],
      };
      expect(issueIdsForCommit(state, ['step-3'])).toEqual(['issue-1']);
    });

    it('ignores commits below the resolution stamp even for the same resolver', () => {
      // step-1 resolved issue-1, a commit carried it, the issue reopened,
      // and step-1 resolved it again; the commit that predates the new
      // resolution must not make it look landed.
      const state = {
        ...stateWith(baseSteps(), [
          issue('issue-1', {
            disposition: 'resolved',
            resolvedByStepId: 'step-1',
            resolvedAtCommitCount: 1,
          }),
        ]),
        commits: [
          {
            kind: 'landed' as const,
            stepIds: ['step-1'],
            issueIds: ['issue-1'],
          },
        ],
      };
      expect(issueIdsForCommit(state, ['step-1'])).toEqual(['issue-1']);
    });
  });

  describe('settleUnclaimableIssues', () => {
    it('demotes a recorded issue whose applicable steps are all terminal', () => {
      const steps = [
        step('step-1', '@nx/js:one', 'succeeded'),
        step('step-2', '@nx/js:two', 'pending'),
      ];
      const result = settleUnclaimableIssues(
        stateWith(steps, [
          issue('issue-1', {
            applicableStepIds: ['step-1'],
            claimedByStepId: 'step-1',
          }),
          issue('issue-2', { applicableStepIds: ['step-2'] }),
        ])
      );
      expect(result.issues.map((i) => [i.id, i.disposition])).toEqual([
        ['issue-1', 'deferred-final'],
        ['issue-2', 'recorded'],
      ]);
      // The claim goes with the demotion; a deferred issue is assigned
      // nowhere.
      expect(result.issues[0].claimedByStepId).toBeUndefined();
    });

    it("releases a terminal assignee's claim while other steps keep the issue claimable", () => {
      const steps = [
        step('step-1', '@nx/js:one', 'succeeded'),
        step('step-2', '@nx/js:two', 'pending'),
      ];
      const result = settleUnclaimableIssues(
        stateWith(steps, [
          issue('issue-1', {
            applicableStepIds: ['step-1', 'step-2'],
            claimedByStepId: 'step-1',
          }),
        ])
      );
      // step-1 can never hand another handoff back; the issue stays
      // recorded for step-2 to claim.
      expect(result.issues[0].disposition).toBe('recorded');
      expect(result.issues[0].claimedByStepId).toBeUndefined();
    });

    it('returns the same state when every recorded issue is still claimable', () => {
      const steps = baseSteps();
      const state = stateWith(steps, [
        issue('issue-1', { applicableStepIds: ['step-2'] }),
      ]);
      expect(settleUnclaimableIssues(state)).toBe(state);
    });
  });

  describe('reopenResolutionsForStep', () => {
    it("reverts the step's uncarried resolution to recorded and records the transition", () => {
      const steps = [
        step('step-1', '@nx/js:one', 'pending'),
        step('step-2', '@nx/js:two', 'pending'),
      ];
      const result = reopenResolutionsForStep(
        stateWith(steps, [
          issue('issue-1', {
            disposition: 'resolved',
            resolvedByStepId: 'step-1',
            applicableStepIds: ['step-1'],
            claimedByStepId: 'step-1',
          }),
        ]),
        'step-1'
      );
      expect(result.state.issues[0].disposition).toBe('recorded');
      expect(result.state.issues[0].resolvedByStepId).toBeUndefined();
      // The claim goes with the discarded attempt: its digest is gone, and
      // the retry may never park for agent work again.
      expect(result.state.issues[0].claimedByStepId).toBeUndefined();
      expect(result.updates).toEqual([
        { issueId: 'issue-1', stepId: 'step-1', disposition: 'recorded' },
      ]);
    });

    it("releases the step's claims on other issues without archiving", () => {
      const steps = [
        step('step-1', '@nx/js:one', 'pending'),
        step('step-2', '@nx/js:two', 'pending'),
      ];
      const result = reopenResolutionsForStep(
        stateWith(steps, [
          issue('issue-1', {
            applicableStepIds: ['step-1'],
            claimedByStepId: 'step-1',
          }),
          issue('issue-2', {
            fingerprint: 'fp-b',
            applicableStepIds: ['step-2'],
            claimedByStepId: 'step-2',
          }),
        ]),
        'step-1'
      );
      expect(result.state.issues[0].claimedByStepId).toBeUndefined();
      expect(result.state.issues[0].disposition).toBe('recorded');
      expect(result.state.issues[1].claimedByStepId).toBe('step-2');
      expect(result.updates).toEqual([]);
    });

    it("reverts a re-resolution despite a commit that carried the step's earlier one", () => {
      // issue-1's resolution by step-1 landed, the issue reopened, and
      // step-1's retry resolved it again (stamping the ledger length); a
      // retry-clean discards that second, uncommitted fix. The commit below
      // the stamp proves only the first.
      const steps = [
        step('step-1', '@nx/js:one', 'pending'),
        step('step-2', '@nx/js:two', 'pending'),
      ];
      const base = stateWith(steps, [
        issue('issue-1', {
          disposition: 'resolved',
          resolvedByStepId: 'step-1',
          applicableStepIds: ['step-1'],
          resolvedAtCommitCount: 1,
        }),
      ]);
      const state: MigrateRunState = {
        ...base,
        commits: [
          {
            kind: 'landed',
            sha: 'abc123',
            stepIds: ['step-1'],
            issueIds: ['issue-1'],
          },
        ],
      };
      const result = reopenResolutionsForStep(state, 'step-1');
      expect(result.state.issues[0].disposition).toBe('recorded');
      expect(result.state.issues[0].resolvedByStepId).toBeUndefined();
    });

    it('reverts to deferred-final when no applicable step can pick the issue back up', () => {
      const steps = [
        step('step-1', '@nx/js:one', 'pending'),
        step('step-2', '@nx/js:two', 'succeeded'),
      ];
      const result = reopenResolutionsForStep(
        stateWith(steps, [
          issue('issue-1', {
            disposition: 'resolved',
            resolvedByStepId: 'step-1',
            applicableStepIds: ['step-2'],
            claimedByStepId: 'step-1',
          }),
        ]),
        'step-1'
      );
      expect(result.state.issues[0].disposition).toBe('deferred-final');
      expect(result.state.issues[0].claimedByStepId).toBeUndefined();
      expect(result.updates).toEqual([
        { issueId: 'issue-1', stepId: 'step-1', disposition: 'deferred-final' },
      ]);
    });

    it("leaves carried resolutions and other steps' resolutions untouched", () => {
      const steps = [
        step('step-1', '@nx/js:one', 'pending'),
        step('step-2', '@nx/js:two', 'succeeded'),
      ];
      const base = stateWith(steps, [
        issue('issue-1', {
          disposition: 'resolved',
          resolvedByStepId: 'step-1',
          applicableStepIds: ['step-1'],
        }),
        issue('issue-2', {
          disposition: 'resolved',
          resolvedByStepId: 'step-2',
          applicableStepIds: ['step-2'],
        }),
      ]);
      const state: MigrateRunState = {
        ...base,
        commits: [
          {
            kind: 'landed',
            sha: 'abc123',
            stepIds: ['step-1'],
            issueIds: ['issue-1'],
          },
        ],
      };
      const result = reopenResolutionsForStep(state, 'step-1');
      expect(result.state).toBe(state);
      expect(result.updates).toEqual([]);
    });
  });

  describe('claimIssuesForStep', () => {
    it('assigns recorded applicable issues to the dispensed step, reassigning from an earlier claimant', () => {
      const state = stateWith(baseSteps(), [
        issue('issue-1', { applicableStepIds: ['step-2', 'step-3'] }),
        issue('issue-2', {
          fingerprint: 'fp-b',
          applicableStepIds: ['step-2'],
          claimedByStepId: 'step-1',
        }),
        issue('issue-3', {
          fingerprint: 'fp-c',
          applicableStepIds: ['step-3'],
        }),
        issue('issue-4', {
          fingerprint: 'fp-d',
          applicableStepIds: 'unknown',
          disposition: 'deferred-final',
        }),
      ]);
      const next = claimIssuesForStep(state, 'step-2');
      expect(next.issues.map((i) => i.claimedByStepId)).toEqual([
        'step-2',
        'step-2',
        undefined,
        undefined,
      ]);
    });

    it('returns the state unchanged when nothing is claimable', () => {
      const state = stateWith(baseSteps(), [
        issue('issue-1', { disposition: 'resolved' }),
      ]);
      expect(claimIssuesForStep(state, 'step-2')).toBe(state);
    });

    it('claims only what the digest can publish and releases a claim pushed past the caps', () => {
      // 21 applicable issues; the digest lists at most 20 entries, so the
      // 21st must not hold an invisible assignment. It starts with a stale
      // claim to pin the release branch.
      const many = Array.from({ length: 21 }, (_, i) =>
        issue(`issue-${i + 1}`, {
          fingerprint: `fp-${i}`,
          applicableStepIds: ['step-2'],
          ...(i === 20 ? { claimedByStepId: 'step-2' } : {}),
        })
      );
      const next = claimIssuesForStep(stateWith(baseSteps(), many), 'step-2');
      const claimed = next.issues.filter((i) => i.claimedByStepId === 'step-2');
      expect(claimed.map((i) => i.id)).toEqual(
        many.slice(0, 20).map((i) => i.id)
      );
      expect(next.issues[20].claimedByStepId).toBeUndefined();
    });
  });

  describe('renderIssueDigestLines', () => {
    it('is empty when the ledger holds nothing unresolved', () => {
      expect(
        renderIssueDigestLines(stateWith(baseSteps()), 'step-2', 'run-1')
      ).toEqual([]);
      expect(
        renderIssueDigestLines(
          stateWith(baseSteps(), [
            issue('issue-1', { disposition: 'resolved' }),
          ]),
          'step-2',
          'run-1'
        )
      ).toEqual([]);
    });

    it('orders assigned, recorded, then deferred, and appends the assignment instruction', () => {
      const lines = renderIssueDigestLines(
        stateWith(baseSteps(), [
          issue('issue-1', {
            disposition: 'deferred-final',
            summary: 'deferred one',
          }),
          issue('issue-2', { fingerprint: 'fp-b', summary: 'future one' }),
          issue('issue-3', {
            fingerprint: 'fp-c',
            summary: 'mine to fix',
            claimedByStepId: 'step-2',
          }),
        ]),
        'step-2',
        'run-1'
      );
      expect(lines[1]).toContain('.nx/migrate-runs/run-1/issues/');
      expect(lines.slice(2, 5)).toEqual([
        '  - issue-3 (assigned to this step): mine to fix',
        '  - issue-2 (recorded): future one',
        '  - issue-1 (deferred past the migration steps): deferred one',
      ]);
      expect(lines[5]).toContain('"issueUpdates"');
    });

    it('omits the assignment instruction when nothing is assigned to the step', () => {
      const lines = renderIssueDigestLines(
        stateWith(baseSteps(), [issue('issue-1')]),
        'step-3',
        'run-1'
      );
      expect(lines.join('\n')).not.toContain('issueUpdates');
    });

    it('truncates long summaries and counts entries past the caps', () => {
      const many = Array.from({ length: 25 }, (_, i) =>
        issue(`issue-${i + 1}`, {
          fingerprint: `fp-${i}`,
          summary: 'x'.repeat(300),
        })
      );
      const lines = renderIssueDigestLines(
        stateWith(baseSteps(), many),
        'step-3',
        'run-1'
      );
      const entryLines = lines.filter((l) => l.startsWith('  - '));
      expect(entryLines).toHaveLength(20);
      expect(entryLines[0]).toContain(`${'x'.repeat(200)}...`);
      expect(lines[lines.length - 1]).toContain('5 more not listed');
    });
  });

  describe('renderUnresolvedIssueLines', () => {
    it('is empty when everything is resolved', () => {
      expect(
        renderUnresolvedIssueLines(
          stateWith(baseSteps(), [
            issue('issue-1', { disposition: 'resolved' }),
          ]),
          'run-1'
        )
      ).toEqual([]);
    });

    it('counts the unresolved issues and lists recorded before deferred', () => {
      const lines = renderUnresolvedIssueLines(
        stateWith(baseSteps(), [
          issue('issue-1', {
            disposition: 'deferred-final',
            summary: 'deferred one',
          }),
          issue('issue-2', { fingerprint: 'fp-b', summary: 'future one' }),
        ]),
        'run-1'
      );
      expect(lines[0]).toContain('2 reported issues remain unresolved');
      expect(lines.slice(1)).toEqual([
        '  - issue-2 (recorded): future one',
        '  - issue-1 (deferred past the migration steps): deferred one',
      ]);
    });
  });

  describe('archiveIssues', () => {
    let dir: string;

    beforeEach(() => {
      dir = mkdtempSync(join(tmpdir(), 'nx-migrate-issues-'));
    });

    afterEach(() => {
      rmSync(dir, { recursive: true, force: true });
    });

    const application = (
      overrides: Partial<Parameters<typeof archiveIssues>[1]> = {}
    ) => ({
      state: stateWith(baseSteps()),
      newIssues: [],
      updates: [],
      ...overrides,
    });

    it('writes a new issue report, detail included, to the run issues directory', () => {
      archiveIssues(
        dir,
        application({
          newIssues: [
            {
              entry: issue('issue-1'),
              report: {
                summary: 'summary of issue-1',
                detail: 'long\ndetail',
                applicableMigrations: ['@nx/js:two'],
              },
            },
          ],
        })
      );
      expect(
        JSON.parse(readFileSync(issueArchivePath(dir, 'issue-1'), 'utf-8'))
      ).toEqual({
        id: 'issue-1',
        fingerprint: 'fp-issue-1',
        summary: 'summary of issue-1',
        reportedByStepId: 'step-1',
        applicableMigrations: ['@nx/js:two'],
        disposition: 'recorded',
        detail: 'long\ndetail',
        updates: [],
      });
    });

    it("archives the reporter's explicit disposition next to the entry's starting one", () => {
      archiveIssues(
        dir,
        application({
          newIssues: [
            {
              entry: issue('issue-1', {
                disposition: 'resolved',
                resolvedByStepId: 'step-1',
              }),
              report: {
                summary: 'summary of issue-1',
                applicableMigrations: ['plain'],
                disposition: 'resolved',
              },
            },
          ],
        })
      );
      const archived = JSON.parse(
        readFileSync(issueArchivePath(dir, 'issue-1'), 'utf-8')
      );
      expect(archived.reportedDisposition).toBe('resolved');
      expect(archived.disposition).toBe('resolved');
    });

    it('appends updates to an archived issue', () => {
      archiveIssues(
        dir,
        application({
          newIssues: [
            {
              entry: issue('issue-1'),
              report: {
                summary: 'summary of issue-1',
                applicableMigrations: ['plain'],
              },
            },
          ],
        })
      );
      archiveIssues(
        dir,
        application({
          updates: [
            {
              issueId: 'issue-1',
              stepId: 'step-2',
              disposition: 'resolved' as const,
              note: 'fixed downstream',
            },
          ],
        })
      );
      const archived = JSON.parse(
        readFileSync(issueArchivePath(dir, 'issue-1'), 'utf-8')
      );
      expect(archived.summary).toBe('summary of issue-1');
      expect(archived.updates).toEqual([
        { stepId: 'step-2', disposition: 'resolved', note: 'fixed downstream' },
      ]);
    });

    it('skips an update record the archive already ends with, so a crash-refold cannot duplicate it', () => {
      const update = {
        issueId: 'issue-1',
        stepId: 'step-2',
        disposition: 'resolved' as const,
        note: 'fixed',
      };
      archiveIssues(
        dir,
        application({
          newIssues: [
            {
              entry: issue('issue-1'),
              report: {
                summary: 'summary of issue-1',
                applicableMigrations: ['plain'],
              },
            },
          ],
          updates: [update],
        })
      );
      archiveIssues(dir, application({ updates: [update] }));
      const archived = JSON.parse(
        readFileSync(issueArchivePath(dir, 'issue-1'), 'utf-8')
      );
      expect(archived.updates).toEqual([
        { stepId: 'step-2', disposition: 'resolved', note: 'fixed' },
      ]);
    });

    it('replays a multi-record batch for one issue without duplicating it', () => {
      const batch = [
        {
          issueId: 'issue-1',
          stepId: 'step-1',
          disposition: 'resolved' as const,
        },
        {
          issueId: 'issue-1',
          stepId: 'step-1',
          disposition: 'deferred-final' as const,
        },
      ];
      archiveIssues(
        dir,
        application({
          newIssues: [
            {
              entry: issue('issue-1'),
              report: {
                summary: 'summary of issue-1',
                applicableMigrations: ['plain'],
              },
            },
          ],
          updates: batch,
        })
      );
      archiveIssues(dir, application({ updates: batch }));
      const archived = JSON.parse(
        readFileSync(issueArchivePath(dir, 'issue-1'), 'utf-8')
      );
      expect(archived.updates).toEqual([
        { stepId: 'step-1', disposition: 'resolved' },
        { stepId: 'step-1', disposition: 'deferred-final' },
      ]);
    });

    it('replaces a corrupt archive with a minimal one rather than dropping the update', () => {
      archiveIssues(
        dir,
        application({
          newIssues: [
            {
              entry: issue('issue-1'),
              report: {
                summary: 'summary of issue-1',
                applicableMigrations: ['plain'],
              },
            },
          ],
        })
      );
      writeFileSync(issueArchivePath(dir, 'issue-1'), 'not json');
      archiveIssues(
        dir,
        application({
          updates: [
            {
              issueId: 'issue-1',
              stepId: 'step-2',
              disposition: 'deferred-final' as const,
            },
          ],
        })
      );
      expect(
        JSON.parse(readFileSync(issueArchivePath(dir, 'issue-1'), 'utf-8'))
      ).toEqual({
        id: 'issue-1',
        reconstructed: true,
        updates: [{ stepId: 'step-2', disposition: 'deferred-final' }],
      });
    });

    it('reconstructs a parseable archive whose identity fields are gone, reporting the loss', () => {
      // `{}` parses fine; appending onto it would silently hide that the
      // issue's own record is gone.
      mkdirSync(join(dir, 'issues'), { recursive: true });
      writeFileSync(issueArchivePath(dir, 'issue-1'), '{}');
      const state = stateWith(baseSteps(), [
        issue('issue-1', { applicableStepIds: ['step-2'] }),
      ]);
      const reconstructed = archiveIssues(dir, {
        state,
        newIssues: [],
        updates: [
          {
            issueId: 'issue-1',
            stepId: 'step-2',
            disposition: 'resolved' as const,
          },
        ],
      });
      expect(reconstructed).toEqual(['issue-1']);
      expect(
        JSON.parse(readFileSync(issueArchivePath(dir, 'issue-1'), 'utf-8'))
      ).toEqual({
        id: 'issue-1',
        fingerprint: 'fp-issue-1',
        summary: 'summary of issue-1',
        reportedByStepId: 'step-1',
        applicableMigrations: ['@nx/js:two'],
        reconstructed: true,
        updates: [{ stepId: 'step-2', disposition: 'resolved' }],
      });
    });

    it('reconstructs a shell whose marker lacks its own issue id, reporting the loss', () => {
      // A bare marker is not an identity; appending onto it would hide that
      // the issue's own record is gone.
      mkdirSync(join(dir, 'issues'), { recursive: true });
      writeFileSync(issueArchivePath(dir, 'issue-1'), '{"reconstructed":true}');
      const state = stateWith(baseSteps(), [
        issue('issue-1', { applicableStepIds: ['step-2'] }),
      ]);
      const reconstructed = archiveIssues(dir, {
        state,
        newIssues: [],
        updates: [
          {
            issueId: 'issue-1',
            stepId: 'step-2',
            disposition: 'resolved' as const,
          },
        ],
      });
      expect(reconstructed).toEqual(['issue-1']);
      expect(
        JSON.parse(readFileSync(issueArchivePath(dir, 'issue-1'), 'utf-8')).id
      ).toBe('issue-1');
    });

    it('rebuilds a marker shell that lost restorable fields while the ledger still holds the entry', () => {
      mkdirSync(join(dir, 'issues'), { recursive: true });
      writeFileSync(
        issueArchivePath(dir, 'issue-1'),
        '{"id":"issue-1","reconstructed":true}'
      );
      const state = stateWith(baseSteps(), [
        issue('issue-1', { applicableStepIds: ['step-2'] }),
      ]);
      const reconstructed = archiveIssues(dir, {
        state,
        newIssues: [],
        updates: [
          {
            issueId: 'issue-1',
            stepId: 'step-2',
            disposition: 'resolved' as const,
          },
        ],
      });
      expect(reconstructed).toEqual(['issue-1']);
      const archived = JSON.parse(
        readFileSync(issueArchivePath(dir, 'issue-1'), 'utf-8')
      );
      expect(archived.summary).toBe('summary of issue-1');
      expect(archived.reconstructed).toBe(true);
    });

    it('reports whether every archive holding the application details survives on disk', () => {
      // A real application never reports and updates the same issue (the
      // parser rejects the cross-array collision), so the new report and
      // the update target different issues.
      archiveIssues(
        dir,
        application({
          newIssues: [
            {
              entry: issue('issue-2', {
                fingerprint: 'fp-issue-2',
                summary: 'summary of issue-2',
              }),
              report: {
                summary: 'summary of issue-2',
                applicableMigrations: ['plain'],
              },
            },
          ],
        })
      );
      const app = application({
        newIssues: [
          {
            entry: issue('issue-1'),
            report: {
              summary: 'summary of issue-1',
              detail: 'the only copy',
              applicableMigrations: ['plain'],
            },
          },
        ],
        updates: [
          {
            issueId: 'issue-2',
            stepId: 'step-1',
            disposition: 'recorded' as const,
            detail: 'refined detail',
          },
        ],
      });
      archiveIssues(dir, app);
      expect(applicationArchivesIntact(dir, app)).toBe(true);
      rmSync(issueArchivePath(dir, 'issue-1'));
      expect(applicationArchivesIntact(dir, app)).toBe(false);
      // A note-only update's archive counts too: the vanished file may
      // hold the only durable copy of an earlier detail.
      const noteOnly = application({
        updates: [
          {
            issueId: 'issue-1',
            stepId: 'step-1',
            disposition: 'resolved' as const,
            note: 'done',
          },
        ],
      });
      expect(applicationArchivesIntact(dir, noteOnly)).toBe(false);
      // A healthy file is not enough: this application's own record, note
      // included, must be among the archived updates.
      archiveIssues(dir, app);
      expect(applicationArchivesIntact(dir, noteOnly)).toBe(false);
      archiveIssues(dir, noteOnly);
      expect(applicationArchivesIntact(dir, noteOnly)).toBe(true);
      // Appearing anywhere is not enough: the application's batch must be
      // the archive's tail, matching the append path's replay rule.
      archiveIssues(
        dir,
        application({
          updates: [
            {
              issueId: 'issue-1',
              stepId: 'step-1',
              disposition: 'deferred-final' as const,
            },
          ],
        })
      );
      expect(applicationArchivesIntact(dir, noteOnly)).toBe(false);
    });

    it("verifies the marked rebuild of a lost archive carrying this application's batch", () => {
      // Lose an archive and let a phase-1-style pass rebuild it. The
      // rebuilt shell carries the ledger's identity values and exactly
      // this batch, so phase 2 accepts it like any other phase-1 output;
      // rejecting it would make the next pass replace the file and lose
      // the batch.
      const entry = issue('issue-1');
      const first = {
        state: stateWith(baseSteps(), [entry]),
        newIssues: [
          {
            entry,
            report: {
              summary: 'summary of issue-1',
              detail: 'the only copy',
              applicableMigrations: ['@nx/js:two'],
            },
          },
        ],
        updates: [],
      };
      archiveIssues(dir, first);
      rmSync(issueArchivePath(dir, 'issue-1'));
      const batch = [
        {
          issueId: 'issue-1',
          stepId: 'step-2',
          disposition: 'resolved' as const,
          note: 'fixed',
        },
      ];
      const phaseOne = {
        state: first.state,
        newIssues: [],
        updates: batch,
      };
      expect(archiveIssues(dir, phaseOne)).toEqual(['issue-1']);
      expect(
        applicationArchivesIntact(dir, {
          state: first.state,
          newIssues: [],
          updates: batch,
        })
      ).toBe(true);
      const archived = JSON.parse(
        readFileSync(issueArchivePath(dir, 'issue-1'), 'utf-8')
      );
      expect(archived.reconstructed).toBe(true);
    });

    it('rejects a first-report archive that lost part of the report', () => {
      const app = application({
        newIssues: [
          {
            entry: issue('issue-1'),
            report: {
              summary: 'summary of issue-1',
              applicableMigrations: ['plain'],
              disposition: 'recorded',
            },
          },
        ],
      });
      archiveIssues(dir, app);
      expect(applicationArchivesIntact(dir, app)).toBe(true);
      // Routing and the reporter's explicit disposition have no other
      // durable copy; a file that lost them is not this report's record.
      const archived = JSON.parse(
        readFileSync(issueArchivePath(dir, 'issue-1'), 'utf-8')
      );
      writeFileSync(
        issueArchivePath(dir, 'issue-1'),
        JSON.stringify({
          ...archived,
          applicableMigrations: ['@nx/js:two'],
          reportedDisposition: undefined,
        })
      );
      expect(applicationArchivesIntact(dir, app)).toBe(false);
    });

    it('rejects a new-issue archive that grew update records between the phases', () => {
      // The id did not exist before this fold and nothing runs between
      // the phases, so a record here is fiction a tolerated failure would
      // authenticate into the issue's history.
      const entry = issue('issue-1');
      const app = {
        state: stateWith(baseSteps(), [entry]),
        newIssues: [
          {
            entry,
            report: {
              summary: 'summary of issue-1',
              applicableMigrations: ['@nx/js:two'],
            },
          },
        ],
        updates: [],
      };
      archiveIssues(dir, app);
      expect(applicationArchivesIntact(dir, app)).toBe(true);
      const archived = JSON.parse(
        readFileSync(issueArchivePath(dir, 'issue-1'), 'utf-8')
      );
      writeFileSync(
        issueArchivePath(dir, 'issue-1'),
        JSON.stringify({
          ...archived,
          updates: [{ stepId: 'step-2', disposition: 'resolved' }],
        })
      );
      expect(applicationArchivesIntact(dir, app)).toBe(false);
    });

    it('keeps earlier reconstructions in the sink when a later batch fails', () => {
      // issue-1's archive is missing, so its batch rebuilds a shell that
      // reads healthy on any retry; issue-2's path is a directory, so its
      // read fails with a non-ENOENT error after that shell is durable.
      // Only this interrupted pass can still surface issue-1's loss.
      mkdirSync(issueArchivePath(dir, 'issue-2'), { recursive: true });
      const state = stateWith(baseSteps(), [
        issue('issue-1', { applicableStepIds: ['step-2'] }),
        issue('issue-2', { applicableStepIds: ['step-2'] }),
      ]);
      const reconstructedIds: string[] = [];
      expect(() =>
        archiveIssues(
          dir,
          {
            state,
            newIssues: [],
            updates: [
              {
                issueId: 'issue-1',
                stepId: 'step-2',
                disposition: 'resolved' as const,
              },
              {
                issueId: 'issue-2',
                stepId: 'step-2',
                disposition: 'resolved' as const,
              },
            ],
          },
          reconstructedIds
        )
      ).toThrow();
      expect(reconstructedIds).toEqual(['issue-1']);
    });

    it('rebuilds an archive whose identity does not match the ledger entry, reporting the loss', () => {
      mkdirSync(join(dir, 'issues'), { recursive: true });
      writeFileSync(
        issueArchivePath(dir, 'issue-1'),
        JSON.stringify({
          id: 'issue-1',
          fingerprint: 'other-fp',
          summary: 'a different problem',
          reportedByStepId: 'step-2',
          applicableMigrations: 'unknown',
          updates: [],
        })
      );
      const state = stateWith(baseSteps(), [
        issue('issue-1', { applicableStepIds: ['step-2'] }),
      ]);
      const reconstructed = archiveIssues(dir, {
        state,
        newIssues: [],
        updates: [
          {
            issueId: 'issue-1',
            stepId: 'step-2',
            disposition: 'resolved' as const,
          },
        ],
      });
      expect(reconstructed).toEqual(['issue-1']);
      const archived = JSON.parse(
        readFileSync(issueArchivePath(dir, 'issue-1'), 'utf-8')
      );
      expect(archived.summary).toBe('summary of issue-1');
      expect(archived.reconstructed).toBe(true);
    });

    it('rebuilds a missing archive from the run state, reports it, and marks the loss', () => {
      const state = stateWith(baseSteps(), [
        issue('issue-1', { applicableStepIds: ['step-2'] }),
      ]);
      const reconstructed = archiveIssues(dir, {
        state,
        newIssues: [],
        updates: [
          {
            issueId: 'issue-1',
            stepId: 'step-2',
            disposition: 'resolved' as const,
          },
        ],
      });
      expect(reconstructed).toEqual(['issue-1']);
      expect(
        JSON.parse(readFileSync(issueArchivePath(dir, 'issue-1'), 'utf-8'))
      ).toEqual({
        id: 'issue-1',
        fingerprint: 'fp-issue-1',
        summary: 'summary of issue-1',
        reportedByStepId: 'step-1',
        applicableMigrations: ['@nx/js:two'],
        reconstructed: true,
        updates: [{ stepId: 'step-2', disposition: 'resolved' }],
      });
    });

    it('propagates a read failure that is not a missing archive instead of overwriting the detail', () => {
      archiveIssues(
        dir,
        application({
          newIssues: [
            {
              entry: issue('issue-1'),
              report: {
                summary: 'summary of issue-1',
                detail: 'critical detail',
                applicableMigrations: ['plain'],
              },
            },
          ],
        })
      );
      const before = readFileSync(issueArchivePath(dir, 'issue-1'), 'utf-8');
      const spy = vi.spyOn(fs, 'readFileSync').mockImplementationOnce(() => {
        throw Object.assign(new Error('permission denied'), {
          code: 'EACCES',
        });
      });
      try {
        expect(() =>
          archiveIssues(
            dir,
            application({
              updates: [
                {
                  issueId: 'issue-1',
                  stepId: 'step-2',
                  disposition: 'deferred-final' as const,
                },
              ],
            })
          )
        ).toThrow('permission denied');
      } finally {
        spy.mockRestore();
      }
      expect(readFileSync(issueArchivePath(dir, 'issue-1'), 'utf-8')).toBe(
        before
      );
    });
  });
});
