import { gitAdd } from './git';

const mockExecCommand = vi.fn();
vi.mock('./exec-command', () => ({
  execCommand: (...args: unknown[]) => mockExecCommand(...args),
}));

vi.mock('../../../utils/workspace-root', () => ({
  workspaceRoot: '/workspace',
}));

describe('gitAdd', () => {
  beforeEach(() => {
    mockExecCommand.mockReset();
  });

  it('should normalize backslash paths in deletedFiles to match git status output', async () => {
    // git status --porcelain returns forward-slash paths
    mockExecCommand.mockImplementation(
      (cmd: string, args: string[], _opts?: unknown) => {
        if (cmd === 'git' && args[0] === 'status') {
          return Promise.resolve(
            ' D .nx/version-plans/version-plan-123.md\n'
          );
        }
        if (cmd === 'git' && args[0] === 'check-ignore') {
          return Promise.reject(new Error('not ignored'));
        }
        if (cmd === 'git' && args[0] === 'add') {
          return Promise.resolve('');
        }
        return Promise.resolve('');
      }
    );

    // On Windows, path.join produces backslash-separated paths
    await gitAdd({
      deletedFiles: ['.nx\\version-plans\\version-plan-123.md'],
      cwd: '/workspace',
    });

    const addCall = mockExecCommand.mock.calls.find(
      (c: unknown[]) =>
        c[0] === 'git' &&
        Array.isArray(c[1]) &&
        (c[1] as string[])[0] === 'add'
    );
    expect(addCall).toBeDefined();
    expect((addCall![1] as string[])[1]).toBe(
      '.nx/version-plans/version-plan-123.md'
    );
  });

  it('should stage deleted files with forward-slash paths unchanged', async () => {
    mockExecCommand.mockImplementation(
      (cmd: string, args: string[], _opts?: unknown) => {
        if (cmd === 'git' && args[0] === 'status') {
          return Promise.resolve(
            ' D .nx/version-plans/version-plan-456.md\n'
          );
        }
        if (cmd === 'git' && args[0] === 'check-ignore') {
          return Promise.reject(new Error('not ignored'));
        }
        if (cmd === 'git' && args[0] === 'add') {
          return Promise.resolve('');
        }
        return Promise.resolve('');
      }
    );

    await gitAdd({
      deletedFiles: ['.nx/version-plans/version-plan-456.md'],
      cwd: '/workspace',
    });

    const addCall = mockExecCommand.mock.calls.find(
      (c: unknown[]) =>
        c[0] === 'git' &&
        Array.isArray(c[1]) &&
        (c[1] as string[])[0] === 'add'
    );
    expect(addCall).toBeDefined();
    expect((addCall![1] as string[])[1]).toBe(
      '.nx/version-plans/version-plan-456.md'
    );
  });
});
