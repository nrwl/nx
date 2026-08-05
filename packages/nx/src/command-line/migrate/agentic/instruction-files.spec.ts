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
});
