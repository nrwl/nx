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
  /** Run directory, as produced by `initRunDir`. */
  runDir: string;
  migration: { package: string; name: string };
  systemPrompt: string;
  instructions: string;
}

/**
 * Writes a step's prompts next to its handoff file and returns how to reach
 * them.
 *
 * Prompts travel as files rather than as command-line arguments because on
 * Windows nx resolves npm-installed agents to `.cmd` shims, which
 * `adaptSpawnForWindowsShim` has to invoke through `cmd.exe /c`: that caps the
 * whole command line at 8191 characters and cannot carry a newline at all. The
 * prompts are several kilobytes of multi-line text, so neither fits. Delivery
 * is by file on every platform so there is a single path to keep working.
 *
 * The parent directory is created by the caller ahead of the handoff path,
 * which lives in the same directory.
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

  // Workspace-relative: the agent resolves this one itself, and its cwd is
  // pinned to the workspace root. It is also the form `<instructions_file>`
  // already uses in the prompt-migration user prompt. Forward slashes because
  // it is read as prose out of the agent's prompt, where a `\` is an escape.
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
