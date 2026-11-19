import { describe, expect, it } from 'vitest';
import { loadEsbuild } from './load-esbuild';

describe('loadEsbuild', () => {
  it.each(['ERR_MODULE_NOT_FOUND', 'MODULE_NOT_FOUND'])(
    'should ask to install esbuild when it cannot be found (%s)',
    async (code) => {
      const notFound = Object.assign(
        new Error(`Cannot find package 'esbuild' imported from executor.js`),
        { code }
      );

      await expect(loadEsbuild(() => Promise.reject(notFound))).rejects.toThrow(
        'The @nx/conformance:bundle-rules executor requires esbuild'
      );
    }
  );

  it('should rethrow other load errors unchanged', async () => {
    const brokenDependency = Object.assign(
      new Error(`Cannot find module '@esbuild/darwin-arm64'`),
      { code: 'MODULE_NOT_FOUND' }
    );

    await expect(
      loadEsbuild(() => Promise.reject(brokenDependency))
    ).rejects.toBe(brokenDependency);
  });

  it('should load the installed esbuild', async () => {
    const esbuild = await loadEsbuild();

    expect(typeof esbuild.build).toBe('function');
  });
});
