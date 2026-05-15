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
 * already lives in the system prompt; this message just tells the agent which
 * migration to apply and where to find the instructions.
 */
export function buildPromptMigrationUserPrompt(
  ctx: PromptMigrationContext
): string {
  const lines = [
    `Apply the following prompt-based migration to this Nx workspace.`,
    ``,
    `Migration: ${ctx.package}@${ctx.version} — ${ctx.name}`,
  ];

  if (ctx.description) {
    lines.push(`Description: ${ctx.description}`);
  }

  lines.push(
    ``,
    `The migration's instructions are in this file (relative to the workspace root):`,
    `  ${ctx.promptPath}`,
    ``,
    `Read that file, apply its instructions, then write your handoff JSON to:`,
    `  ${ctx.handoffFileAbsolutePath}`
  );

  return lines.join('\n');
}
