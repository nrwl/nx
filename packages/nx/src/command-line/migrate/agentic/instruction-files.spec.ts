import { mkdirSync, mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { writeInstructionsFile } from './instruction-files';

describe('writeInstructionsFile', () => {
  let workspaceRoot: string;
  let promptsDir: string;
  const instructionsRelativePath =
    '.nx/migrate-runs/run-1/prompts/step-1/instructions.md';

  beforeEach(() => {
    workspaceRoot = mkdtempSync(join(tmpdir(), 'nx-instruction-files-'));
    promptsDir = join(workspaceRoot, '.nx/migrate-runs/run-1/prompts/step-1');
    mkdirSync(promptsDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(workspaceRoot, { recursive: true, force: true });
  });

  // A POSIX `relative()` cannot produce the separators this normalizes, so a
  // win32 `relative` is the only way in. It arrives by re-import: a spy on the
  // `path` namespace does not reach the module's own import binding.
  it('rewrites Windows separators in the returned path to forward slashes', async () => {
    vi.resetModules();
    vi.doMock('path', async () => {
      const actual = await vi.importActual<typeof import('path')>('path');
      return { ...actual, relative: actual.win32.relative };
    });

    try {
      const { writeInstructionsFile: writeWithWin32Relative } =
        await import('./instruction-files');

      expect(
        writeWithWin32Relative(workspaceRoot, promptsDir, 'do the thing')
      ).toBe(instructionsRelativePath);
    } finally {
      vi.doUnmock('path');
      vi.resetModules();
    }
  });

  // A directory in the way is what makes the write fail.
  it('names the instructions file when the write fails', () => {
    mkdirSync(join(promptsDir, 'instructions.md'));

    expect(() =>
      writeInstructionsFile(workspaceRoot, promptsDir, 'do the thing')
    ).toThrow(/Could not write the step's instructions to .*instructions\.md/);
  });
});
