import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TempFs } from '@nx/devkit/internal-testing-utils';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import runExecutor from './executor';

vi.mock('./load-esbuild', () => ({
  loadEsbuild: () =>
    Promise.reject(
      new Error('The @nx/conformance:bundle-rules executor requires esbuild.')
    ),
}));

describe('Bundle Rules Executor without esbuild', () => {
  let tempFs: TempFs;

  beforeEach(() => {
    tempFs = new TempFs('bundle-rules-executor-missing-esbuild');
  });

  afterEach(() => {
    tempFs.cleanup();
    vi.restoreAllMocks();
  });

  it('should report the missing esbuild before deleting the output', async () => {
    await tempFs.createFiles({ 'dist/stale.js': '' });
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await runExecutor({ outputPath: 'dist' }, {
      projectName: 'rules',
      root: tempFs.tempDir,
      projectsConfigurations: {
        projects: { rules: { root: 'projects/rules' } },
      },
    } as any);

    expect(result.success).toBe(false);
    expect(consoleSpy).toHaveBeenCalledWith(
      'The @nx/conformance:bundle-rules executor requires esbuild.'
    );
    expect(existsSync(join(tempFs.tempDir, 'dist/stale.js'))).toBe(true);
  });
});
