export interface PromptMigrationContext {
  package: string;
  name: string;
  version: string;
  description?: string;
  /** Workspace-relative path to the prompt `.md` file. */
  promptPath: string;
  /** Absolute path the agent must write its handoff file to. */
  handoffFileAbsolutePath: string;
}

/**
 * Builds the first user-facing message for a prompt-migration step.
 *
 * Keeps the framing short — the heavy lifting (handoff contract, scope rules)
 * already lives in the system prompt; this message just identifies the
 * migration and points at the instructions file.
 *
 * XML tags wrap path values and the migration metadata so the agent does not
 * misread them as headers or prose. See `system-prompt.ts` for the rationale
 * behind the structuring convention.
 */
export function buildPromptMigrationUserPrompt(
  ctx: PromptMigrationContext
): string {
  const lines = [
    `Apply one prompt-based migration to this Nx workspace.`,
    ``,
    `<migration>`,
    `package: ${ctx.package}`,
    `version: ${ctx.version}`,
    `name: ${ctx.name}`,
  ];

  if (ctx.description) {
    lines.push(...renderKeyMultilineValue('description', ctx.description));
  }

  lines.push(
    `</migration>`,
    ``,
    `<instructions_file>${ctx.promptPath}</instructions_file>`,
    ``,
    `Open the instructions file (path is workspace-relative), follow its instructions step by step, then write your handoff JSON to:`,
    `<handoff_path>`,
    ctx.handoffFileAbsolutePath,
    `</handoff_path>`
  );

  return lines.join('\n');
}

// YAML block-scalar form (`key: |`) for multi-line values inside `<migration>`,
// so embedded newlines don't break the inner block's visual grouping.
function renderKeyMultilineValue(key: string, value: string): string[] {
  const valueLines = value.split('\n');
  if (valueLines.length === 1) {
    return [`${key}: ${value}`];
  }
  return [`${key}: |`, ...valueLines.map((line) => `  ${line}`)];
}
