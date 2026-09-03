import { claudeCodeHandoffAllowedTools } from '../definitions';
import { AgentId, InvocationSpec } from '../types';

export interface MasterInvocationContext {
  runId: string;
  reconcileCommand: string;
  /** Workspace-relative with forward slashes: prose the agent reads, not a shell path. */
  runbookPath: string;
}

// One line with no `%`: the Windows shim refuses line breaks and the pinned
// text is what its command-line budget is measured against.
export function masterInvariant(ctx: MasterInvocationContext): string {
  return `You are driving Nx migrate run ${ctx.runId}. Its state lives on disk and is owned by nx migrate; never infer its progress from this conversation. Whenever you are unsure what to do, after a compaction or restart, and after you finish any piece of work, run \`${ctx.reconcileCommand}\` and follow the step block it returns. The run's contract is the runbook at ${ctx.runbookPath}; re-read it whenever a step block says so.`;
}

export function masterBootstrapPrompt(ctx: MasterInvocationContext): string {
  return `Read the runbook at ${ctx.runbookPath} in full, then run \`${ctx.reconcileCommand}\` and follow the step block it returns.`;
}

const OPENCODE_AGENT_NAME = 'nx-migrate';

// Keyed by agent id so a new agent fails to compile until it gets a builder.
const builders: Record<
  AgentId,
  (ctx: MasterInvocationContext) => InvocationSpec
> = {
  'claude-code': (ctx) => {
    const allowedTools = claudeCodeHandoffAllowedTools(ctx.runId);
    return {
      // `--allowedTools` is variadic: the non-variadic flag between it and
      // the positional prompt keeps the prompt from being read as a rule.
      args: [
        ...(allowedTools ? ['--allowedTools', allowedTools] : []),
        '--append-system-prompt',
        masterInvariant(ctx),
        masterBootstrapPrompt(ctx),
      ],
    };
  },
  codex: (ctx) => ({
    args: [
      '-c',
      `developer_instructions=${masterInvariant(ctx)}`,
      masterBootstrapPrompt(ctx),
    ],
  }),
  opencode: (ctx) => ({
    args: [
      '--agent',
      OPENCODE_AGENT_NAME,
      '--prompt',
      masterBootstrapPrompt(ctx),
    ],
    env: {
      OPENCODE_CONFIG_CONTENT: JSON.stringify({
        agent: { [OPENCODE_AGENT_NAME]: { prompt: masterInvariant(ctx) } },
      }),
    },
  }),
};

export function buildMasterInvocation(
  agentId: AgentId,
  ctx: MasterInvocationContext
): InvocationSpec {
  return builders[agentId](ctx);
}
