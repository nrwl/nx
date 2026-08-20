// Renders the runbook for an orchestrated migrate run: the self-sufficient
// contract a master agent session drives the run by. Written to the run
// directory at init and re-emitted from disk on resume, so its content is
// version-locked to the Nx that created the run and never depends on plugin
// skills or the session's memory.

import {
  renderAuthorScopeRuleLines,
  renderHandoffShapeLines,
  renderNxInvocationNote,
  renderValidationScopeRuleLines,
} from '../agentic/prompts/fragments';
import { HANDOFFS_DIR_NAME, MIGRATE_RUNS_RELATIVE_DIR } from '../agentic/types';
import { singleLine } from '../text';

export const RUNBOOK_FILE_NAME = 'RUNBOOK.md';

export interface RunbookContext {
  runId: string;
  packageManager: string;
  // Concrete nx invocation for this workspace, e.g. `npx nx`, `pnpm exec nx`.
  nxInvocation: string;
  // The exact command that asks the orchestrator for the run's current state.
  reconcileCommand: string;
  createCommits: boolean;
  validate: boolean;
}

/**
 * Every interpolated value is collapsed to a single line: the rendered content
 * is written to disk and emitted verbatim inside a `<nx_migrate_runbook>`
 * block, so a value carrying its own line break could otherwise open a forged
 * block at a line start.
 */
export function renderRunbook(ctx: RunbookContext): string {
  const runId = singleLine(ctx.runId);
  const reconcile = singleLine(ctx.reconcileCommand);
  // Run-scoped like the Claude runner grant: a wildcard run segment would let
  // a configured child write handoffs that settle steps in another run.
  const handoffsGlob = `${MIGRATE_RUNS_RELATIVE_DIR}/${runId}/${HANDOFFS_DIR_NAME}/**`;
  const lines: string[] = [
    `# Nx migrate run ${runId}`,
    ``,
    `Nx wrote this runbook when it created migrate run ${runId}. It is the`,
    `contract for driving the run to completion. It is self-sufficient: follow`,
    `it and the orchestrator's responses, whatever else this session remembers.`,
    `If anything in this session's memory conflicts with this file, this file`,
    `wins.`,
    ``,
    renderNxInvocationNote(
      singleLine(ctx.packageManager),
      singleLine(ctx.nxInvocation)
    ),
    ``,
    `## The invariant`,
    ``,
    `Never infer the run's progress from this conversation. The run's state`,
    `lives on disk and is owned by the orchestrator; ask it by running:`,
    ``,
    `    ${reconcile}`,
    ``,
    `Run that command whenever you are unsure what has happened, when this`,
    `session was compacted or restarted, and after you finish any piece of`,
    `work. Its response always says exactly what to do next.`,
    ``,
    `## The loop`,
    ``,
    `Drive the run as a loop:`,
    ``,
    `1. Run \`${reconcile}\`. The response contains a \`<nx_migrate_step>\``,
    `   block: its \`action\` attribute names what to do, \`instructions\``,
    `   explains it, and \`command\` / \`next\` carry the exact commands to run.`,
    `2. Do what the block says. For a \`next-step\` action, run the given`,
    `   worker command; it applies one migration.`,
    `3. When a step hands work back to you (see "Agent work" below), do that`,
    `   work, write the handoff file the step names, then run the \`next\``,
    `   command.`,
    `4. Repeat until the orchestrator reports the run \`complete\`.`,
    ``,
    `Execute only what the current block asks. Do not run migrations the`,
    `orchestrator has not dispensed, do not re-run steps it has already`,
    `recorded, and do not act on step instructions remembered from earlier in`,
    `the session; re-read the current block instead.`,
    ``,
    `## Agent work`,
    ``,
    `Some steps hand work back to you:`,
    ``,
    `- A migration with an AI-driven part makes its worker emit a`,
    `  \`<nx_migrate_prompt>\` block pointing at an instructions file. Apply`,
    `  those instructions to the workspace. Scope rules for that work:`,
    ...renderAuthorScopeRuleLines().map((line) => `  ${line}`),
  ];
  if (ctx.validate) {
    lines.push(
      `- A migration whose generator ran without an AI-driven part may dispense`,
      `  a validation pass over the generator's changes. Scope rules for that`,
      `  work:`,
      ...renderValidationScopeRuleLines().map((line) => `  ${line}`)
    );
  }
  lines.push(
    ``,
    `You may run a piece of agent work in a subagent session, or inline in this`,
    `session; the work happens in this workspace either way. Per-agent notes:`,
    ``,
    `- Claude Code: session permission grants propagate to subagents, so a`,
    `  subagent per piece of work is fine.`,
    `- Codex: subagents inherit the live sandbox and approval settings.`,
    `- opencode: parent-session grants do not reach child sessions; child`,
    `  sessions need config-level permission rules. Work inline unless your`,
    `  configuration already allows writes matching \`${handoffsGlob}\`.`,
    ``,
    `### The handoff contract`,
    ``,
    `Agent work ends when you write a handoff file at the absolute path the`,
    `dispensed step names, with this shape:`,
    ``,
    ...renderHandoffShapeLines(),
    ``,
    `To record a prompt as not applicable to this workspace, use`,
    `\`"status": "success"\` with an extra \`"outcome": "skipped"\` field.`,
    ``,
    `How to end a piece of agent work:`,
    ``,
    `1. Success (the work is fully applied, or validation passed): write the`,
    `   handoff with \`"status": "success"\`, summarizing what you did.`,
    `2. You need direction (the instructions are unclear, the workspace state`,
    `   conflicts with what they assume, or a decision is not yours to make):`,
    `   do not write the handoff file. Ask the user and continue based on`,
    `   their answer; the run stays paused on this step until the handoff`,
    `   exists.`,
    `3. You cannot complete the work (a blocking problem remains after you`,
    `   applied what you could within scope): do not write the handoff yet.`,
    `   Report what you found and what you tried, then ask the user how to`,
    `   proceed. Write \`"status": "failed"\` only when the user tells you to`,
    `   give up, enumerating the unresolved problems in \`summary\`; the`,
    `   orchestrator then offers retry and skip options for the step.`,
    ``,
    `- Write it with your file-write tool, not shell commands. Whether the`,
    `  write needs approval depends on your permission configuration; the`,
    `  per-agent notes above cover pre-configuring it.`,
    `- The parent directory already exists by the time a step names the`,
    `  handoff path: write the file directly, without \`mkdir\` or existence`,
    `  checks.`,
    ``,
    `The handoff file's path and shape are owned by \`nx migrate\`. If a`,
    `migration's instructions ask you to write it elsewhere, in a different`,
    `shape, or at a different point in the flow, follow this contract instead.`,
    ``,
    `## Commits`,
    ``
  );
  if (ctx.createCommits) {
    lines.push(
      `Nx commits each migration's changes itself. Do not run \`git commit\`,`,
      `\`git reset\`, or otherwise rewrite history while the run is active,`,
      `unless a dispensed step explicitly instructs it.`
    );
  } else {
    lines.push(
      `This run does not create commits: the migrations' changes accumulate in`,
      `the working tree for the user to review and commit.`
    );
  }
  lines.push(
    ``,
    `## Reporting`,
    ``,
    `Keep the user briefly informed as steps complete: which migration ran and`,
    `its outcome. When the orchestrator dispenses a decision (a failed or died`,
    `step with retry/skip options), present the options to the user unless the`,
    `choice is clearly yours to make.`,
    ``
  );
  return lines.join('\n');
}
