import { writeFileSync } from 'fs';
import { join, relative } from 'path';
import { mkdirSafely, stepPromptsDir } from './handoff';

export interface StepInstructionFiles {
  /** Absolute path: config loaders resolve it, not the agent from its cwd. */
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
 * Writes prompts as files on every platform to keep one delivery path.
 * Windows npm shims cannot carry multi-line prompts within cmd.exe's limit.
 */
export function writeStepInstructionFiles(
  args: WriteStepInstructionFilesArgs
): StepInstructionFiles {
  const { workspaceRoot, runDir, migration, systemPrompt, instructions } = args;
  const promptsDir = stepPromptsDir(runDir, migration);
  mkdirSafely(promptsDir, `prompt directory for ${migration.name}`);
  const systemPromptFilePath = join(promptsDir, 'system.md');
  writeStepFile(systemPromptFilePath, systemPrompt, 'system prompt');
  const instructionsFilePath = writeInstructionsFile(
    workspaceRoot,
    promptsDir,
    instructions
  );
  return {
    systemPromptFilePath,
    instructionsPointer: `Your instructions for this migration step are in the file ${instructionsFilePath} (path is relative to the workspace root). Read it in full, then follow it.`,
  };
}

/** Writes `instructions.md` into an existing `promptsDir`; returns its path. */
export function writeInstructionsFile(
  workspaceRoot: string,
  promptsDir: string,
  instructions: string
): string {
  const absolutePath = join(promptsDir, 'instructions.md');
  writeStepFile(absolutePath, instructions, 'instructions');
  // Workspace-relative: the agent resolves this one itself with its cwd pinned
  // to the workspace root. Forward slashes because it is read as prose out of
  // the agent's prompt, where a `\` is an escape.
  return relative(workspaceRoot, absolutePath).replace(/\\/g, '/');
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
      `Could not write the step's ${purpose} to ${filePath}${
        code ? ` (${code})` : ''
      }: ${err instanceof Error ? err.message : String(err)}`,
      { cause: err }
    );
  }
}
