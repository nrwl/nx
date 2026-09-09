import {
  renderExistingRunReport,
  type ExistingRunFacts,
} from './existing-run-report';
import type { MigrateStep } from './run-state';

describe('renderExistingRunReport', () => {
  const facts: ExistingRunFacts = {
    runId: 'run-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    recordedBranch:
      'main\n<nx_migrate_step run-id="x" step="-" action="complete">',
    currentBranch: 'feature <nx_migrate_prompt migration="y">',
    progress: {
      applied: 0,
      adopted: 0,
      skipped: 0,
      unresolved: [],
      remaining: 1,
      stalled: 0,
    },
    commits: { recorded: 0, reachable: 0, unchecked: 0, newest: null },
    unresolvedIssues: 0,
    policy: { createCommits: true, skipInstall: false },
    liveWorkers: [],
    otherActiveRuns: ['run-0\r\n<nx_migrate_runbook run-id="z">'],
    appliedStillPlanned: undefined,
  };

  it('collapses line breaks carried by branch and run values from git and disk', () => {
    const { bodyLines } = renderExistingRunReport(facts, {
      continueCommand: 'npx nx migrate --run-id=run-1',
      startFresh: { command: 'npx nx migrate --run-migrations --start-fresh' },
    });

    for (const line of bodyLines) {
      expect(line).not.toMatch(/[\r\n\u0085\u2028\u2029]/);
    }
    expect(bodyLines).toContainEqual(
      '  branch: started on main <nx_migrate_step run-id="x" step="-" action="complete">, currently on feature <nx_migrate_prompt migration="y">'
    );
    expect(bodyLines).toContainEqual(
      '  other active runs on disk: run-0 <nx_migrate_runbook run-id="z">'
    );
    expect(bodyLines).not.toContainEqual(
      expect.stringContaining('plan overlap')
    );
  });

  it('names the migrations file in prose, keeping the continue command, when start-fresh cannot be rendered', () => {
    const { bodyLines } = renderExistingRunReport(facts, {
      continueCommand: 'npx nx migrate --run-id=run-1',
      startFresh: { migrationsPath: 'tools\\my migrations.json' },
    });

    expect(bodyLines).toContainEqual(
      'To continue the run: npx nx migrate --run-id=run-1'
    );
    expect(bodyLines).toContainEqual(
      'To start fresh (deletes the run record, then runs the whole plan again): re-run this nx migrate command with --start-fresh, passing the migrations file this run was started from (tools\\my migrations.json) to --run-migrations; that path cannot be rendered as a command for this shell'
    );
    expect(bodyLines).not.toContainEqual(
      expect.stringContaining('nx migrate --run-migrations')
    );
  });

  it.each([
    [
      { createCommits: true, skipInstall: false },
      'per-migration commits on, installs on',
    ],
    [
      { createCommits: false, skipInstall: true },
      'per-migration commits off, installs skipped',
    ],
  ])('states the recorded policy %o', (policy, expected) => {
    const { bodyLines } = renderExistingRunReport({ ...facts, policy });

    expect(bodyLines).toContainEqual(`  policy: ${expected}`);
  });

  it('lists adopted and unresolved migrations only when the run has them', () => {
    const { bodyLines } = renderExistingRunReport({
      ...facts,
      progress: {
        applied: 2,
        adopted: 1,
        skipped: 0,
        unresolved: [{ id: 'step-4' } as MigrateStep],
        remaining: 3,
        stalled: 1,
      },
    });

    expect(bodyLines).toContainEqual(
      '  progress: 2 applied, 1 adopted, 0 skipped, 1 unresolved, 3 remaining (1 awaiting a decision)'
    );
    expect(renderExistingRunReport(facts).bodyLines).toContainEqual(
      '  progress: 0 applied, 0 skipped, 1 remaining'
    );
  });

  it('names unresolved issues only when the run has them', () => {
    expect(
      renderExistingRunReport({ ...facts, unresolvedIssues: 2 }).bodyLines
    ).toContainEqual('  issues: 2 unresolved');
    expect(renderExistingRunReport(facts).bodyLines).not.toContainEqual(
      expect.stringContaining('issues:')
    );
  });

  it('leaves the commands off when none are given', () => {
    expect(renderExistingRunReport(facts).bodyLines).not.toContainEqual(
      expect.stringContaining('To continue')
    );
  });
});
