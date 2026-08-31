// Wording the agent system prompt (system-prompt.ts) and the orchestrated
// run's runbook (run/runbook.ts) must state identically.

import { formatCommandFor } from '../format-command';

export function renderNxInvocationNote(
  packageManager: string,
  nxInvocation: string
): string {
  return `Use \`${packageManager}\` for any package-manager invocation in this workspace. To invoke nx, use \`${nxInvocation} ...\`. Do not default to a different package manager based on your own preference.`;
}

// One-line form for a dispensed step; the block form is the contract itself.
export function renderHandoffShapeInline(summaryHint: string): string {
  return `{ "status": "success" | "failed", "summary": "<${summaryHint}>" }`;
}

export function renderHandoffShapeLines(): string[] {
  return [
    `{`,
    `  "status": "success" | "failed",`,
    `  "summary": "[one to three sentences: what was done, or why it failed]"`,
    `}`,
  ];
}

/**
 * Where the formatter command comes from. A prompt built right before the
 * agent runs carries the resolved command; the runbook outlives many steps,
 * so it points at the `Format command:` line each dispensed step resolves.
 */
export type FormatInstruction =
  | { source: 'command'; command: string | null }
  | { source: 'dispensed-step' };

// Scope rules for applying an author-provided migration prompt (prompt-only or
// hybrid migration).
export function renderAuthorScopeRuleLines(
  pmExec: string,
  format: FormatInstruction
): string[] {
  return [
    `- Apply only the changes the migration prompt asks for.`,
    `- Do not refactor or update dependencies beyond what the migration prompt directs, and do not reformat files you did not change.`,
    renderFormatRule(pmExec, format),
    `- Do not modify files outside the workspace root.`,
    `- Do not run \`nx\` commands that mutate workspace state (\`nx migrate\`, \`nx reset\`, \`nx format:write\`, \`nx run-many\`, generators, etc.). Read-only inspection (\`nx show\`, \`nx graph --file\`, reading files) is fine.`,
    `- If the migration instructions are unclear, internally inconsistent, or conflict with the current workspace state, ask the user for direction (see the handoff contract). Do not guess.`,
  ];
}

const FORMAT_SCOPE = `over exactly the files you created or modified`;
// oxfmt with no paths formats every file under cwd (its no-target default,
// with or without the flag), so the no-files case must be said explicitly.
const NO_FILES = `If you created or modified no files, do not run it.`;
const NO_NX_FORMAT = `Do not use \`nx format:write\` for this: it also selects files changed earlier on the branch and always reformats the root config files.`;

function renderFormatRule(pmExec: string, format: FormatInstruction): string {
  // The command is resolved before the step runs, so the step that adds or
  // replaces the formatter is the one case it cannot cover; name the exact
  // replacements so the agent does not have to guess flags.
  const replacement = `If this migration itself added or replaced the workspace formatter, run the new one ${FORMAT_SCOPE} instead: \`${formatCommandFor(
    'prettier',
    pmExec
  )}\` for Prettier, \`${formatCommandFor('oxfmt', pmExec)}\` for oxfmt. ${NO_FILES}`;
  switch (format.source) {
    case 'command':
      return format.command === null
        ? `- This workspace has no formatter configured; do not run one over your changes. ${replacement}`
        : `- After applying your changes and before writing the handoff, run \`${format.command}\` ${FORMAT_SCOPE} (the flag keeps the command from failing when some or all of those paths are files the formatter does not handle). ${replacement} ${NO_NX_FORMAT}`;
    case 'dispensed-step':
      return `- After applying your changes and before writing the handoff, run the command on the dispensed step's \`Format command:\` line ${FORMAT_SCOPE}; when that line says none, do not run a formatter. ${replacement} ${NO_NX_FORMAT}`;
    default: {
      const unhandled: never = format;
      throw new Error(
        `Unhandled format instruction: ${JSON.stringify(unhandled)}`
      );
    }
  }
}

export function renderValidationScopeRuleLines(): string[] {
  return [
    `- Your job is to validate the generator's changes. Inspect the listed changes, run the smallest relevant set of verification tasks, and report findings.`,
    `- Discover what targets exist before running tasks: \`nx show project <name> --json\` is authoritative, since it includes targets inferred by plugins. Reading a project's \`project.json\` / \`package.json\` misses inferred targets; treat it as an incomplete fallback for when the project graph cannot be built. Do not assume specific target names (\`typecheck\`, \`test\`, \`lint\`) are available, since workspaces vary. Run what the project actually has; if no typecheck-equivalent exists, \`build\` is an acceptable substitute.`,
    `- You may run nx tasks for verification, scoped to this migration's changes: \`nx affected --files=<comma-separated changed paths> -t <target>\`, \`nx run <project>:<target>\`, or \`nx run-many -t <target> -p <project1>,<project2>\` where the project list is derived from the changed files. Bare \`nx affected\` (no \`--files\`) selects the branch delta plus everything uncommitted, and unscoped \`nx run-many\` (no \`-p\`) is forbidden.`,
    `- Read-only and artifact-writing inspection commands are permitted: \`nx show project\`, \`nx graph --file <path>\`, reading files. These do not mutate workspace source.`,
    `- You may apply minor fixes only when the issue lies within the scope of what this migration intended to accomplish (e.g. a missing import the generator's template should have produced, a type annotation the template missed). Do not refactor, do not modify unrelated functionality, do not extend the migration's scope, do not touch code the migration was not concerned with. If you are unsure whether a fix is in scope, report it in \`summary\` instead of applying.`,
    `- Do not run other \`nx\` commands that mutate workspace state (\`nx migrate\`, \`nx reset\`, generators, etc.).`,
    `- Do not modify files outside the workspace root.`,
    `- If validation finds blocking issues you cannot resolve within scope: apply every fix you can within scope, then report the unresolved findings to the user and ask how to proceed (see the handoff contract). Do not guess.`,
  ];
}
