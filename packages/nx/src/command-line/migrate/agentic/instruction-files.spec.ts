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

  it('writes both prompts beside the step handoff file', () => {
    const files = write(
      'the system prompt\nover two lines',
      'the instructions'
    );

    expect(files.systemPromptFilePath).toMatch(
      /[\\/]handoffs[\\/]@nx\+eslint\+update-23-1-0-[0-9a-f]{64}\.system\.md$/
    );
    expect(readFileSync(files.systemPromptFilePath, 'utf-8')).toBe(
      'the system prompt\nover two lines'
    );
    expect(
      readFileSync(stepFilePath(runDir, migration, '.instructions.md'), 'utf-8')
    ).toBe('the instructions');
  });

  it('points at the instructions relative to the workspace root, where the agent runs', () => {
    const files = write();

    expect(files.instructionsPointer).toMatch(
      /\.nx\/migrate-runs\/23\.1\.0\/handoffs\/@nx\+eslint\+update-23-1-0-[0-9a-f]{64}\.instructions\.md/
    );
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

      expect(files.instructionsPointer).toMatch(
        /\.nx\/migrate-runs\/23\.1\.0\/handoffs\/@nx\+eslint\+update-23-1-0-[0-9a-f]{64}\.instructions\.md/
      );
    } finally {
      vi.doUnmock('path');
      vi.resetModules();
    }
  });

  it('sanitizes migration identifiers into the file names', () => {
    const files = writeStepInstructionFiles({
      workspaceRoot,
      runDir,
      migration: { package: '@scope/pkg', name: '..' },
      systemPrompt: 'system prompt',
      instructions: 'do the thing',
    });

    expect(files.systemPromptFilePath).toMatch(
      /[\\/]handoffs[\\/]@scope\+pkg\+_-[0-9a-f]{64}\.system\.md$/
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
      /Could not write the migration step's instructions to .*update-23-1-0-[0-9a-f]{64}\.instructions\.md/
    );
  });
});
