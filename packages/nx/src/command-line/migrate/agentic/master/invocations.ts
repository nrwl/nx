import {
  claudeCodeHandoffAllowedTools,
  copilotCliHandoffAllowTool,
  encodeTomlString,
} from '../definitions';
import {
  type AgentId,
  type InvocationSpec,
  MIGRATE_RUNS_RELATIVE_DIR,
} from '../types';

export interface MasterInvocationContext {
  runId: string;
  reconcileCommand: string;
  /** Workspace-relative with forward slashes: prose the agent reads, not a shell path. */
  runbookPath: string;
  /** Same form as `runbookPath`; its existence closes the session. */
  sentinelPath: string;
}

// One line with no `%`: the Windows shim refuses line breaks and the pinned
// text is what its command-line budget is measured against.
export function masterInvariant(ctx: MasterInvocationContext): string {
  return `You are driving Nx migrate run ${ctx.runId}. Its state lives on disk and is owned by nx migrate; never infer its progress from this conversation. Whenever you are unsure what to do, after a compaction or restart, and after you finish any piece of work, run \`${ctx.reconcileCommand}\` and follow the step block it returns. The run's contract is the runbook at ${ctx.runbookPath}; re-read it whenever a step block says so. When a step block reports the run complete, tell the user the outcome, then create the file ${ctx.sentinelPath} as your last action; nx closes this session once it exists.`;
}

export function masterBootstrapPrompt(ctx: MasterInvocationContext): string {
  return `Read the runbook at ${ctx.runbookPath} in full, then run \`${ctx.reconcileCommand}\` and follow the step block it returns.`;
}

const OPENCODE_AGENT_NAME = 'nx-migrate';

// Copilot CLI loads `.github/instructions/*.instructions.md` from each
// directory in this comma-separated list. Older versions such as 1.0.6 read no
// other layout there.
const COPILOT_INSTRUCTIONS_DIRS_VAR = 'COPILOT_CUSTOM_INSTRUCTIONS_DIRS';
const COPILOT_INSTRUCTIONS_DIR_NAME = 'copilot';
// Copilot CLI subagents load the same custom instructions, including the
// invariant's order to reconcile, and reconciling after a handoff advances the
// run.
const COPILOT_SUBAGENT_RULE =
  'If another agent started you as its subagent, do not run nx migrate commands or write handoff files; report your results to that agent instead.';
// Copilot CLI collapses shell output, so the user sees `[nx]` progress lines
// only if the agent repeats them.
const COPILOT_PROGRESS_RULE =
  'Each time you read the output of a command that is still running, tell the user in one sentence what its latest [nx] line says.';

function copilotInstructionsDirs(runId: string): string {
  // Relative, so only the run id lands in the list: Copilot CLI resolves it
  // against the session cwd, which every caller pins to the workspace root.
  const dir = `${MIGRATE_RUNS_RELATIVE_DIR}/${runId}/${COPILOT_INSTRUCTIONS_DIR_NAME}`;
  const configured = process.env[COPILOT_INSTRUCTIONS_DIRS_VAR];
  return configured ? `${configured},${dir}` : dir;
}

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
      `developer_instructions=${encodeTomlString(masterInvariant(ctx))}`,
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
  copilot: (ctx) => {
    const allowTool = copilotCliHandoffAllowTool(ctx.runId);
    return {
      args: [
        ...(allowTool ? [`--allow-tool=${allowTool}`] : []),
        '--interactive',
        masterBootstrapPrompt(ctx),
      ],
      env: {
        [COPILOT_INSTRUCTIONS_DIRS_VAR]: copilotInstructionsDirs(ctx.runId),
      },
      files: [
        {
          path: `${COPILOT_INSTRUCTIONS_DIR_NAME}/.github/instructions/nx-migrate.instructions.md`,
          content: `${masterInvariant(ctx)} ${COPILOT_SUBAGENT_RULE} ${COPILOT_PROGRESS_RULE}`,
        },
      ],
    };
  },
};

export function buildMasterInvocation(
  agentId: AgentId,
  ctx: MasterInvocationContext
): InvocationSpec {
  return builders[agentId](ctx);
}
