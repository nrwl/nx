import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { stepFilePath } from './handoff';
import { writeStepInstructionFiles } from './instruction-files';

describe('writeStepInstructionFiles', () => {
  let workspaceRoot: string;
  let runDir: string;
  const migration = { package: '@nx/eslint', name: 'update-23-1-0' };

  beforeEach(() => {
    workspaceRoot = mkdtempSync(join(tmpdir(), 'nx-instruction-files-'));
    runDir = join(workspaceRoot, '.nx', 'migrate-runs', '23.1.0');
    mkdirSync(dirname(stepFilePath(runDir, migration, '.json')), {
      recursive: true,
    });
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
    '.nx/migrate-runs/23.1.0/handoffs/@nx/eslint/update-23-1-0.instructions.md';

  it('writes both prompts beside the step handoff file', () => {
    const files = write(
      'the system prompt\nover two lines',
      'the instructions'
    );

    expect(files.systemPromptFilePath).toBe(
      join(runDir, 'handoffs', '@nx', 'eslint', 'update-23-1-0.system.md')
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

  // Only `relative()` can put a backslash in the pointer, and only on Windows,
  // where it emits them as separators. It cannot come from the migration:
  // `sanitizeSegment` rewrites a backslash in the package or name to `_` before
  // the path is assembled, so on POSIX the normalization has nothing to do and
  // deleting it would leave every other test in this file green. Hence the
  // re-import under a win32 `relative`: a spy on the `path` namespace does not
  // reach the module's own import binding.
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

  // Windows cannot open a file whose name carries a reserved character, and a
  // `..` segment would put the write outside the run directory entirely.
  it('sanitizes migration identifiers into the file names', () => {
    mkdirSync(join(runDir, 'handoffs', '@scope', 'pkg'), { recursive: true });
    const files = writeStepInstructionFiles({
      workspaceRoot,
      runDir,
      migration: { package: '@scope/pkg', name: '..' },
      systemPrompt: 'system prompt',
      instructions: 'do the thing',
    });

    expect(files.systemPromptFilePath).toBe(
      join(runDir, 'handoffs', '@scope', 'pkg', '_.system.md')
    );
  });

  it('names the file it could not write', () => {
    expect(() =>
      writeStepInstructionFiles({
        workspaceRoot,
        runDir: join(runDir, 'does', 'not', 'exist'),
        migration,
        systemPrompt: 'system prompt',
        instructions: 'do the thing',
      })
    ).toThrow(/Could not write the migration step's system prompt to .*ENOENT/);
  });

  // A directory in the way fails the second write and only the second, which
  // is what it takes to see whether the diagnostic names the right file.
  it('names the instructions file when that is the write that failed', () => {
    mkdirSync(stepFilePath(runDir, migration, '.instructions.md'));

    expect(() => write()).toThrow(
      /Could not write the migration step's instructions to .*update-23-1-0\.instructions\.md/
    );
  });
});
