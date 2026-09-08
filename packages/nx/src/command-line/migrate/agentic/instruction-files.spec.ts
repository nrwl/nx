import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { stepPromptsDir } from './handoff';
import { writeStepInstructionFiles } from './instruction-files';

describe('writeStepInstructionFiles', () => {
  let workspaceRoot: string;
  let runDir: string;
  const migration = { package: '@nx/eslint', name: 'update-23-1-0' };

  beforeEach(() => {
    workspaceRoot = mkdtempSync(join(tmpdir(), 'nx-instruction-files-'));
    runDir = join(workspaceRoot, '.nx', 'migrate-runs', '23.1.0');
  });

  afterEach(() => {
    rmSync(workspaceRoot, { recursive: true, force: true });
  });

  function write(
    systemPrompt = 'system prompt',
    instructions = 'do the thing'
  ) {
    return writeStepInstructionFiles({
      workspaceRoot,
      runDir,
      migration,
      systemPrompt,
      instructions,
    });
  }

  const instructionsRelativePath =
    '.nx/migrate-runs/23.1.0/prompts/@nx/eslint/update-23-1-0/instructions.md';

  it('writes both prompts to their own directory beside the handoff file', () => {
    const files = write(
      'the system prompt\nover two lines',
      'the instructions'
    );

    expect(files.systemPromptFilePath).toBe(
      join(runDir, 'prompts', '@nx', 'eslint', 'update-23-1-0', 'system.md')
    );
    expect(readFileSync(files.systemPromptFilePath, 'utf-8')).toBe(
      'the system prompt\nover two lines'
    );
    expect(
      readFileSync(join(workspaceRoot, instructionsRelativePath), 'utf-8')
    ).toBe('the instructions');
  });

  it('points at the instructions relative to the workspace root, where the agent runs', () => {
    const files = write();

    expect(files.instructionsPointer).toContain(instructionsRelativePath);
    expect(files.instructionsPointer).not.toMatch(/[\r\n]/);
  });

  // A POSIX `relative()` cannot produce the separators this normalizes, and
  // `sanitizeSegment` rewrites a backslash in the package or name to `_` before
  // the path is assembled, so a win32 `relative` is the only way in. It arrives
  // by re-import: a spy on the `path` namespace does not reach the module's own
  // import binding.
  it('rewrites Windows separators in the pointer to forward slashes', async () => {
    vi.resetModules();
    vi.doMock('path', async () => {
      const actual = await vi.importActual<typeof import('path')>('path');
      return { ...actual, relative: actual.win32.relative };
    });

    try {
      const { writeStepInstructionFiles: writeWithWin32Relative } =
        await import('./instruction-files');
      const files = writeWithWin32Relative({
        workspaceRoot,
        runDir,
        migration,
        systemPrompt: 'system prompt',
        instructions: 'do the thing',
      });

      expect(files.instructionsPointer).toContain(instructionsRelativePath);
    } finally {
      vi.doUnmock('path');
      vi.resetModules();
    }
  });

  // A `..` segment would put the write outside the run directory entirely.
  it('sanitizes migration identifiers into the directory names', () => {
    const files = writeStepInstructionFiles({
      workspaceRoot,
      runDir,
      migration: { package: '@scope/pkg', name: '..' },
      systemPrompt: 'system prompt',
      instructions: 'do the thing',
    });

    expect(files.systemPromptFilePath).toBe(
      join(runDir, 'prompts', '@scope', 'pkg', '_', 'system.md')
    );
  });

  // A name this long only fits as a directory of its own; as a filename prefix
  // the suffix would push it past the 255-character limit.
  it('writes prompts for a migration name that fills a path component', () => {
    const files = writeStepInstructionFiles({
      workspaceRoot,
      runDir,
      migration: { package: '@nx/eslint', name: 'a'.repeat(250) },
      systemPrompt: 'system prompt',
      instructions: 'do the thing',
    });

    expect(readFileSync(files.systemPromptFilePath, 'utf-8')).toBe(
      'system prompt'
    );
  });

  // A directory in the way fails one write and only that one, which is what it
  // takes to see whether the diagnostic names the right file.
  it.each([
    ['system prompt', 'system.md'],
    ['instructions', 'instructions.md'],
  ])(
    'names the %s file when that is the write that failed',
    (purpose, file) => {
      mkdirSync(join(stepPromptsDir(runDir, migration), file), {
        recursive: true,
      });

      expect(() => write()).toThrow(
        new RegExp(
          `Could not write the migration step's ${purpose} to .*${file}`
        )
      );
    }
  );
});
