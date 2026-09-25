import { singleLine } from '../../text';
import { renderFinalValidationScopeRuleLines } from './fragments';
import { renderHandoffPathFooter } from './shared-rendering';

export interface FinalValidationInstructionsContext {
  runId: string;
  // The commit the run started from; null when the run could not record one.
  baseRef: string | null;
  nxInvocation: string;
  handoffFileAbsolutePath: string;
}

/**
 * The final-validation step's instructions file. The runbook already carries
 * the handoff contract, so this states the task, the base ref and the scope
 * rules.
 */
export function buildFinalValidationInstructions(
  ctx: FinalValidationInstructionsContext
): string {
  const nx = singleLine(ctx.nxInvocation);
  const base = ctx.baseRef === null ? null : singleLine(ctx.baseRef);
  const selection =
    base === null
      ? `The run could not record the commit it started from, so select every project: \`${nx} run-many -t <targets>\`. Expect this to take longer than an affected run.`
      : `The run started from commit ${base}. Select the projects it touched with \`${nx} affected --base ${base} -t <targets>\`; \`${nx} show projects --affected --base ${base}\` lists them. Read the run's changes with \`git diff ${base}\` (the working tree included).`;
  const lines = [
    `You are running the final validation pass of Nx migrate run ${singleLine(
      ctx.runId
    )}. Every migration step has run; their changes are committed or sitting in the working tree, as the run's commit policy decided. Check that the workspace still lints, builds and passes its unit tests, fix what the migrations broke, and report what you could not attribute to them.`,
    ``,
    `<validation_instructions>`,
    `1. ${selection}`,
    `2. Discover the targets of the selected projects with \`${nx} show project <name> --json\`. Group them into three families: lint (\`lint\` and equivalents), build (\`build\`, or \`typecheck\` where a project has no build), and unit tests (\`test\` and equivalents). Note which projects have no target in a family; the handoff summary reports that.`,
    `3. Run the families in order, lint first, then build, then unit tests, each over the whole selection in one run.`,
    `4. For each failure, decide from the run's diff whether the migrations caused it. Fix what they caused, within the scope rules, then rerun only the failed tasks. Mark each failure you report instead as possibly pre-existing.`,
    `5. Work through the "Known issues" digest the dispense listed: those the run deferred to this step are yours to resolve where the scope rules allow, and each result goes in the handoff's \`issueUpdates\`.`,
    `6. End the step per the handoff contract. On success, the summary lists which families ran, which projects had no target in a family, what you fixed, and what you left.`,
    `</validation_instructions>`,
    ``,
    `<scope_rules>`,
    ...renderFinalValidationScopeRuleLines(),
    `</scope_rules>`,
    ``,
    `When you end the step per the handoff contract, your handoff path is:`,
    ...renderHandoffPathFooter(ctx.handoffFileAbsolutePath),
  ];
  return lines.join('\n');
}
