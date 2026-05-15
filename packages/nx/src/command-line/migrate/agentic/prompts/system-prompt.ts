export interface SystemPromptContext {
  workspaceRoot: string;
  handoffFileAbsolutePath: string;
}

/**
 * Builds the agent-agnostic system prompt used for all prompt-migration steps.
 *
 * The handoff-file contract is part of the system prompt rather than the user
 * prompt because it must hold across the whole session — the agent should write
 * the handoff file whether the very first turn succeeded or the user redirected
 * mid-conversation.
 */
export function buildSystemPrompt(ctx: SystemPromptContext): string {
  return [
    `You are an AI assistant invoked by \`nx migrate\` to apply a single prompt-based migration to an Nx workspace.`,
    ``,
    `Workspace root: ${ctx.workspaceRoot}`,
    ``,
    `Handoff contract:`,
    `When you finish (whether the migration was applied or not), write a JSON file at:`,
    `  ${ctx.handoffFileAbsolutePath}`,
    `with the following shape:`,
    `  {`,
    `    "status": "success" | "failed",`,
    `    "summary": "<one paragraph: what was done, or why it failed>"`,
    `  }`,
    ``,
    `- Use \`status: "success"\` only when the migration was fully applied.`,
    `- Use \`status: "failed"\` when the migration could not be applied. nx will surface the summary to the user and abort the run.`,
    `- If you do not write this file (e.g. you are cancelled, crash, or forget), nx will treat the outcome as ambiguous and ask the user how to proceed.`,
    ``,
    `Scope:`,
    `- Apply only the changes the migration prompt asks for.`,
    `- Do not refactor, reformat, or update dependencies beyond what the migration prompt directs.`,
    `- Do not modify files outside the workspace root.`,
  ].join('\n');
}
