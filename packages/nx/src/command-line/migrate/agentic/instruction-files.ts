import { writeFileSync } from 'fs';
import { relative } from 'path';
import { stepFilePath } from './handoff';

export interface StepInstructionFiles {
  /**
   * Absolute path of the file holding the step's system prompt. Absolute
   * because the agent's own config loader resolves it (Claude Code's
   * `--system-prompt-file`, opencode's `{file:...}` substitution), not the
   * agent itself from its cwd.
   */
  systemPromptFilePath: string;
  /** Single-line command-line text pointing the agent at its instructions. */
  instructionsPointer: string;
}

export interface WriteStepInstructionFilesArgs {
  workspaceRoot: string;
  runDir: string;
  migration: { package: string; name: string };
  systemPrompt: string;
  instructions: string;
}

/**
 * Writes a step's prompts next to its handoff file and returns how to reach
 * them. The prompts travel as files rather than as command-line arguments
 * because on Windows npm-installed agents resolve to `.cmd` shims invoked
 * through `cmd.exe /c`, which caps the command line at 8191 characters and
 * cannot carry a newline, and the prompts are kilobytes of multi-line text.
 * Delivery is by file on every platform so that there is one path to keep
 * working.
 *
 * The caller creates the parent directory, ahead of the handoff path.
 */
export function writeStepInstructionFiles(
  args: WriteStepInstructionFilesArgs
): StepInstructionFiles {
  const { workspaceRoot, runDir, migration, systemPrompt, instructions } = args;
  const systemPromptFilePath = stepFilePath(runDir, migration, '.system.md');
  const instructionsAbsolutePath = stepFilePath(
    runDir,
    migration,
    '.instructions.md'
  );
  writeStepFile(systemPromptFilePath, systemPrompt, 'system prompt');
  writeStepFile(instructionsAbsolutePath, instructions, 'instructions');

  // Workspace-relative: the agent resolves this one itself with its cwd pinned
  // to the workspace root. Forward slashes because it is read as prose out of
  // the agent's prompt, where a `\` is an escape.
  const instructionsFilePath = relative(
    workspaceRoot,
    instructionsAbsolutePath
  ).replace(/\\/g, '/');
  return {
    systemPromptFilePath,
    instructionsPointer: `Your instructions for this migration step are in the file ${instructionsFilePath} (path is relative to the workspace root). Read it in full, then follow it.`,
  };
}

function writeStepFile(
  filePath: string,
  contents: string,
  purpose: string
): void {
  try {
    writeFileSync(filePath, contents, 'utf-8');
  } catch (err) {
    const code = (err as NodeJS.ErrnoException)?.code;
    throw new Error(
      `Could not write the migration step's ${purpose} to ${filePath}${
        code ? ` (${code})` : ''
      }: ${err instanceof Error ? err.message : String(err)}`,
      { cause: err }
    );
  }
}
