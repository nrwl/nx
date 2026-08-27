// Written to the run directory at init and re-emitted from disk on resume, so
// the contract is version-locked to the Nx that created the run and never
// depends on plugin skills or the session's memory.

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
  // e.g. `npx nx`, `pnpm exec nx`.
  nxInvocation: string;
  // See `resolveFormatCommand`; null when the workspace has no formatter.
  formatCommand: string | null;
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
    `3. When a step hands work back to you (see "Agent work" below), run the`,
    `   \`next\` command first: its response restates the work, names the`,
    `   handoff file to write, and lists any recorded issues assigned to the`,
    `   step. Do the work, write the handoff file, then run \`next\` again.`,
    `4. Repeat until the orchestrator reports the run \`complete\`.`,
    ``,
    `Execute only what the current block asks. Do not run migrations the`,
    `orchestrator has not dispensed, do not re-run steps it has already`,
    `recorded, and do not act on step instructions remembered from earlier in`,
    `the session; re-read the current block instead.`,
    ``,
    `Getting the same response repeatedly means the run has not advanced; the`,
    `orchestrator eventually says so with a \`no-progress\` action. Act on the`,
    `repeated instructions or report the blocker to the user; re-running the`,
    `reconcile command alone changes nothing.`,
    ``,
    `## Agent work`,
    ``,
    `Some steps hand work back to you:`,
    ``,
    `- A migration with an AI-driven part makes its worker emit a`,
    `  \`<nx_migrate_prompt>\` block pointing at an instructions file. Apply`,
    `  those instructions to the workspace. Scope rules for that work:`,
    ...renderAuthorScopeRuleLines(
      ctx.formatCommand === null ? null : singleLine(ctx.formatCommand)
    ).map((line) => `  ${line}`),
    `  The \`nx migrate\` commands this runbook and the step blocks hand you`,
    `  (the reconcile, worker and \`next\` commands) are the exception to that`,
    `  rule: run them as given.`,
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
    `If a step's \`<nx_migrate_prompt>\` block is no longer in your context`,
    `(after a compaction or a restart), run \`${reconcile}\`; the awaiting`,
    `step's dispense re-emits it.`,
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
    `To record a piece of work as not applicable to this workspace, follow`,
    `the dispensed step's handoff instructions: where the step offers it, use`,
    `\`"status": "success"\` with an extra \`"outcome": "skipped"\` field;`,
    `where it does not (a generator's changes are already applied), use plain`,
    `\`"status": "success"\` and say so in the summary.`,
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
    `### Reporting issues`,
    ``,
    `The orchestrator keeps a ledger of issues reported over the run; full`,
    `details are archived under ${MIGRATE_RUNS_RELATIVE_DIR}/${runId}/issues/.`,
    `Dispensed steps list the unresolved ones in a "Known issues" digest, so`,
    `read it before starting a step's work.`,
    ``,
    `Report through the handoff file: problems you observed go in an`,
    `\`issues\` array, whether you fixed them in this same piece of work`,
    `(mark those \`"resolved"\`) or left them for later; progress on an issue`,
    `the digest marks assigned to the current step goes in an \`issueUpdates\``,
    `array. Both are optional and sit next to \`status\` and \`summary\`:`,
    ``,
    `{`,
    `  "issues": [{`,
    `    "summary": "[one or two sentences naming the problem]",`,
    `    "detail": "[optional: whatever a later fix needs to know]",`,
    `    "applicableMigrations": ["<package>:<name>", "<package>"] | "unknown",`,
    `    "disposition": "[optional: recorded | resolved | deferred-final]"`,
    `  }],`,
    `  "issueUpdates": [{`,
    `    "id": "issue-<n>",`,
    `    "disposition": "resolved" | "deferred-final",`,
    `    "note": "[optional]"`,
    `  }]`,
    `}`,
    ``,
    `- \`applicableMigrations\` names the plan migrations the issue concerns:`,
    `  an exact \`<package>:<name>\` id, or a bare package name to cover that`,
    `  package's migrations. Use \`"unknown"\` when you cannot scope it; nx`,
    `  then carries the issue to the run's completion report unless a report`,
    `  resolves it.`,
    `- Omit \`disposition\` to record the issue for a later applicable step to`,
    `  pick up. Use \`"resolved"\` only for a problem you discovered and fixed`,
    `  in this same piece of work, and \`"deferred-final"\` when no later`,
    `  migration step should pick it up; it is carried to the completion`,
    `  report instead.`,
    `- \`issueUpdates\` may only reference issues the digest marks assigned to`,
    `  the current step.`,
    `- Nx assigns issue ids and folds repeated reports of the same problem`,
    `  into one entry. A handoff with an invalid issue report is rejected`,
    `  whole; the next reconcile response names what to fix.`,
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
