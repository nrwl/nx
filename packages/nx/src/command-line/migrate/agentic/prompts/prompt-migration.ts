import { escapeXmlBody, renderKeyMultilineValue } from './shared-rendering';

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
 * XML tags wrap path values and the migration metadata so the agent does
 * not misread them as headers or prose.
 */
export function buildPromptMigrationUserPrompt(
  ctx: PromptMigrationContext
): string {
  const lines = [
    `Apply one prompt-based migration to this Nx workspace.`,
    ``,
    `<migration>`,
    `package: ${escapeXmlBody(ctx.package)}`,
    `version: ${escapeXmlBody(ctx.version)}`,
    `name: ${escapeXmlBody(ctx.name)}`,
  ];

  if (ctx.description) {
    lines.push(
      ...renderKeyMultilineValue('description', escapeXmlBody(ctx.description))
    );
  }

  lines.push(
    `</migration>`,
    ``,
    `<instructions_file>${escapeXmlBody(ctx.promptPath)}</instructions_file>`,
    ``,
    `Open the instructions file (path is workspace-relative), follow its instructions step by step, then write your handoff JSON to:`,
    `<handoff_path>`,
    escapeXmlBody(ctx.handoffFileAbsolutePath),
    `</handoff_path>`
  );

  return lines.join('\n');
}
