import { writeFileSync } from 'fs';
import { join, relative } from 'path';

/** Writes `instructions.md` into an existing `promptsDir`; returns its path. */
export function writeInstructionsFile(
  workspaceRoot: string,
  promptsDir: string,
  instructions: string
): string {
  const absolutePath = join(promptsDir, 'instructions.md');
  try {
    writeFileSync(absolutePath, instructions, 'utf-8');
  } catch (err) {
    const code = (err as NodeJS.ErrnoException)?.code;
    throw new Error(
      `Could not write the step's instructions to ${absolutePath}${
        code ? ` (${code})` : ''
      }: ${err instanceof Error ? err.message : String(err)}`,
      { cause: err }
    );
  }
  // Workspace-relative: the agent resolves this one itself with its cwd pinned
  // to the workspace root. Forward slashes because it is read as prose out of
  // the agent's prompt, where a `\` is an escape.
  return relative(workspaceRoot, absolutePath).replace(/\\/g, '/');
}
