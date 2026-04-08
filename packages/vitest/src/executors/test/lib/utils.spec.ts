import { workspaceRoot } from '@nx/devkit';
import { isAbsolute, join } from 'path';
import { resolveReportsDirectory } from './utils';

describe('resolveReportsDirectory', () => {
  it('should resolve a workspace-root-relative path to absolute', () => {
    // After Nx's resolveNxTokensInOptions processes "{workspaceRoot}/coverage/apps/my-app",
    // the value becomes "coverage/apps/my-app" (workspace-root-relative).
    const result = resolveReportsDirectory('coverage/apps/my-app');
    expect(isAbsolute(result)).toBe(true);
    expect(result).toBe(join(workspaceRoot, 'coverage/apps/my-app'));
  });

  it('should return absolute paths unchanged', () => {
    const absolutePath = '/tmp/coverage/my-app';
    const result = resolveReportsDirectory(absolutePath);
    expect(result).toBe(absolutePath);
  });

  it('should resolve a simple relative path to absolute', () => {
    // A plain relative path like "coverage" (no tokens originally)
    // also gets resolved against workspace root
    const result = resolveReportsDirectory('coverage');
    expect(isAbsolute(result)).toBe(true);
    expect(result).toBe(join(workspaceRoot, 'coverage'));
  });
});
