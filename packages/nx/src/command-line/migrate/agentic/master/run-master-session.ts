import { output } from '../../../../utils/output';
import {
  reportMigrateRunComplete,
  reportMigrateRunError,
} from '../../migrate-analytics';
import {
  completionSummaryLines,
  completionWarnings,
  hasUnresolvedIssues,
  MigrateRunPolicy,
  MigrateRunState,
  OrchestratorInitResult,
  pmExecPrefix,
  readRunState,
  renderExistingRunReport,
  runDir,
  runOrchestratorInit,
  RunOrchestratorInitInput,
  runOrchestratorResume,
  renderStartFresh,
  tallySteps,
} from '../../run';
import { canPrompt, migrateChoice } from '../../safe-prompt';
import { DetectedInstalledAgent } from '../types';
import { spawnMasterSession } from './spawn-master';

export interface RunMasterSessionInput extends Omit<
  RunOrchestratorInitInput,
  'emitAgentInstructions' | 'onExistingRun'
> {
  agent: DetectedInstalledAgent;
  interactive?: boolean;
  // The active run to continue instead of starting one (`--run-id`).
  runId?: string;
  // Delete the active run's record and start a new one (`--start-fresh`).
  startFresh?: boolean;
  // Asked by init before it starts a run (never before a report or a
  // continue); false stops with nothing started.
  confirmNewRun: () => Promise<boolean>;
}

// The policy flags are always explicit: a continue must resolve to the run's
// recorded policy, and nx.json can flip the bare default either way.
function continueCommand(
  root: string,
  agentId: string,
  runId: string,
  policy: MigrateRunPolicy
): string {
  return `${pmExecPrefix(root)} nx migrate --run-migrations --agentic=${agentId} --run-id=${runId} ${policy.createCommits ? '--create-commits' : '--no-create-commits'}${policy.skipInstall ? ' --skip-install' : ''}`;
}

function startFreshCommand(
  root: string,
  agentId: string,
  runMigrationsFlag: string
): string {
  return `${pmExecPrefix(root)} nx migrate ${runMigrationsFlag} --agentic=${agentId} --start-fresh`;
}

/**
 * Starts (or continues) an orchestrated run and hands it to one agent session
 * that drives it through `--run-id` reconciles. Run state is the only
 * authority on the outcome: the exit code follows what run.json says once the
 * session ends, not what the agent process returned.
 */
export async function runMasterSession(
  input: RunMasterSessionInput
): Promise<number | undefined> {
  const {
    agent,
    interactive,
    runId: requestedRunId,
    startFresh,
    confirmNewRun,
    ...init
  } = input;
  // The invocation's policy; an interactive continue adopts the run's recorded
  // one instead, shown in the report and the choice, so resume, broker and
  // the resume hint agree with the run.
  let policy: MigrateRunPolicy = {
    createCommits: init.createCommits,
    skipInstall: init.skipInstall,
  };
  let ready: OrchestratorInitResult;
  if (requestedRunId !== undefined) {
    ready = runOrchestratorResume({
      root: init.root,
      runId: requestedRunId,
      policy,
      emitAgentInstructions: false,
    });
  } else {
    ready = await runOrchestratorInit({
      ...init,
      emitAgentInstructions: false,
      onExistingRun: startFresh ? 'start-fresh' : 'report',
      confirmStart: confirmNewRun,
    });
  }
  if (ready.kind === 'existing-run') {
    const decision = await decideExistingRun(
      ready,
      init.root,
      agent.id,
      init.migrationsPath,
      interactive
    );
    if (decision === undefined) {
      return 1;
    }
    if (decision === 'abort') {
      output.log({
        title: `Leaving migrate run ${ready.runId} as it is. ${continueHint(init.root, agent.id, ready.runId, ready.facts.policy)}`,
      });
      return;
    }
    if (decision === 'continue') {
      policy = ready.facts.policy;
      ready = runOrchestratorResume({
        root: init.root,
        runId: ready.runId,
        policy,
        emitAgentInstructions: false,
      });
    } else {
      ready = await runOrchestratorInit({
        ...init,
        emitAgentInstructions: false,
        onExistingRun: 'start-fresh',
        // The consent covers the run the user saw; a run that replaced it
        // since is reported, not deleted.
        replaceRunId: ready.runId,
        confirmStart: confirmNewRun,
      });
    }
    if (ready.kind === 'existing-run') {
      printExistingRunReport(ready, init.root, agent.id, init.migrationsPath);
      return 1;
    }
  }
  if (ready.kind === 'refused') {
    return;
  }
  const { runId, runRoot, runbookPath, reconcileCommand } = ready;
  const resumeHint = continueHint(init.root, agent.id, runId, policy);

  output.log({
    title: `Starting ${agent.displayName} to drive migrate run ${runId}.`,
  });
  const session = await spawnMasterSession({
    agent,
    runRoot,
    runId,
    runbookPath,
    reconcileCommand,
    policy,
  });
  if (session.kind === 'spawn-failed') {
    output.error({
      title: `Could not start ${agent.displayName}: ${session.error.message}`,
      bodyLines: [`Migrate run ${runId} is still active. ${resumeHint}`],
    });
    reportMigrateRunError({ code: 'agentic', error: session.error });
    return 1;
  }
  if (session.kind === 'broker-failed') {
    // The broker itself reads run.json, so its failure can mean the state is
    // unreadable; the read below decides whether a resume is safe to offer.
    output.error({
      title: `Closed the ${agent.displayName} session: a step's request could not be answered (${session.error.message}).`,
    });
    reportMigrateRunError({ code: 'agentic', error: session.error });
  }

  let state: MigrateRunState;
  try {
    state = readRunState(runDir(runRoot, runId));
  } catch (error) {
    // No resume hint: run discovery skips a directory whose run.json is
    // missing, so a rerun could start a second run over the same plan.
    output.error({
      title: `Nx could not determine whether migrate run ${runId} completed.`,
      bodyLines: [error instanceof Error ? error.message : String(error)],
    });
    return 1;
  }
  switch (state.status) {
    case 'active':
      output.warn({
        title: `Migrate run ${runId} is still active. ${resumeHint}`,
      });
      return 1;
    case 'completed': {
      const tally = tallySteps(state);
      output.log({
        title: `Migrate run ${runId} is complete.`,
        bodyLines: completionSummaryLines(state),
      });
      for (const lines of completionWarnings(runRoot, runId, state)) {
        output.warn({ title: lines[0], bodyLines: lines.slice(1) });
      }
      reportMigrateRunComplete({
        agenticOutcome: 'enabled',
        agentUsed: agent.id,
        migrationCount: state.steps.length,
        appliedCount: tally.applied + tally.adopted,
      });
      // Exit 0 is for a run that left nothing to resolve: a migration given
      // up on or a reported problem nobody fixed is the user's to finish.
      if (tally.unresolved.length > 0 || hasUnresolvedIssues(state)) {
        output.warn({
          title: `Migrate run ${runId} left work unresolved; exiting with code 1.`,
        });
        return 1;
      }
      return;
    }
    default: {
      const unhandled: never = state.status;
      throw new Error(`Unhandled migrate run status: ${unhandled}`);
    }
  }
}

function continueHint(
  root: string,
  agentId: string,
  runId: string,
  policy: MigrateRunPolicy
): string {
  return `Run ${continueCommand(root, agentId, runId, policy)} to continue it.`;
}

function printExistingRunReport(
  found: Extract<OrchestratorInitResult, { kind: 'existing-run' }>,
  root: string,
  agentId: string,
  migrationsPath: string | undefined
): void {
  output.warn(
    renderExistingRunReport(found.facts, {
      continueCommand: continueCommand(
        root,
        agentId,
        found.runId,
        found.facts.policy
      ),
      startFresh: renderStartFresh(migrationsPath, (flag) =>
        startFreshCommand(root, agentId, flag)
      ),
    })
  );
}

/**
 * The user's call on an active run found where a new one would start. On a
 * terminal, asks; otherwise prints the report with both commands and returns
 * undefined, which the caller turns into exit 1: nothing was done and
 * nothing could be asked.
 */
async function decideExistingRun(
  found: Extract<OrchestratorInitResult, { kind: 'existing-run' }>,
  root: string,
  agentId: string,
  migrationsPath: string | undefined,
  interactive: boolean | undefined
): Promise<'continue' | 'start-fresh' | 'abort' | undefined> {
  if (!canPrompt(interactive)) {
    printExistingRunReport(found, root, agentId, migrationsPath);
    return undefined;
  }
  output.log(renderExistingRunReport(found.facts));
  return migrateChoice({
    message: 'What do you want to do with the active migrate run?',
    choices: [
      {
        value: 'continue',
        label: 'Continue it',
        hint: 'picks the run up where it stopped, keeping its recorded commit and install policy',
      },
      {
        value: 'start-fresh',
        label: 'Start fresh',
        hint: 'deletes the run record only; the whole plan runs again',
      },
      { value: 'abort', label: 'Abort', hint: 'leaves the run as it is' },
    ],
  });
}
