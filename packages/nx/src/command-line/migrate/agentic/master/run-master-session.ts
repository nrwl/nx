import { output } from '../../../../utils/output';
import {
  reportMigrateRunComplete,
  reportMigrateRunError,
} from '../../migrate-analytics';
import {
  completionWarnings,
  MigrateRunState,
  readRunState,
  runDir,
  runOrchestratorInit,
  RunOrchestratorInitInput,
} from '../../run';
import { DetectedInstalledAgent } from '../types';
import { spawnMasterSession } from './spawn-master';

export interface RunMasterSessionInput extends Omit<
  RunOrchestratorInitInput,
  'emitAgentInstructions'
> {
  agent: DetectedInstalledAgent;
}

/**
 * Starts (or resumes) an orchestrated run and hands it to one agent session
 * that drives it through `--run-id` reconciles. Run state is the only
 * authority on the outcome: the exit code follows what run.json says once the
 * session ends, not what the agent process returned.
 */
export async function runMasterSession(
  input: RunMasterSessionInput
): Promise<number | undefined> {
  const { agent, ...init } = input;
  const ready = await runOrchestratorInit({
    ...init,
    emitAgentInstructions: false,
  });
  if (ready.kind === 'refused') {
    return;
  }
  const { runId, runRoot, runbookPath, reconcileCommand } = ready;
  // Not rendered: the gate env var and the migrations path would have to be
  // reproduced, and the same command carries both.
  const resumeHint = 'Run the same nx migrate command again to resume it.';

  output.log({
    title: `Starting ${agent.displayName} to drive migrate run ${runId}.`,
  });
  const session = await spawnMasterSession({
    agent,
    runRoot,
    runId,
    runbookPath,
    reconcileCommand,
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
      const applied = state.steps.filter(
        (s) => s.status === 'succeeded'
      ).length;
      const skipped = state.steps.filter((s) => s.status === 'skipped').length;
      output.log({
        title: `Migrate run ${runId} is complete.`,
        bodyLines: [`  applied: ${applied}`, `  skipped: ${skipped}`],
      });
      for (const lines of completionWarnings(runRoot, runId, state)) {
        output.warn({ title: lines[0], bodyLines: lines.slice(1) });
      }
      reportMigrateRunComplete({
        agenticOutcome: 'enabled',
        agentUsed: agent.id,
        migrationCount: state.steps.length,
        appliedCount: applied,
      });
      return;
    }
    default: {
      const unhandled: never = state.status;
      throw new Error(`Unhandled migrate run status: ${unhandled}`);
    }
  }
}
