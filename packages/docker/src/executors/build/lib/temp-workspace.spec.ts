import { existsSync } from 'fs';
import { cleanupTempWorkspace, createTempWorkspace } from './temp-workspace';

describe('temp-workspace', () => {
  it('creates a directory that exists on disk', () => {
    const dir = createTempWorkspace();
    expect(existsSync(dir)).toBe(true);
    cleanupTempWorkspace(dir);
  });

  it('removes the directory and its contents on cleanup', () => {
    const dir = createTempWorkspace();
    cleanupTempWorkspace(dir);
    expect(existsSync(dir)).toBe(false);
  });

  it('does nothing for an empty path', () => {
    expect(() => cleanupTempWorkspace('')).not.toThrow();
  });
});
