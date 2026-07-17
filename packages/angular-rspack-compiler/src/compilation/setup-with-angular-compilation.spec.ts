import { describe, expect, it, vi } from 'vitest';
import type { AngularCompilation, SourceFileCache } from '../models';
import { setupCompilationWithAngularCompilation } from './setup-with-angular-compilation';
import type { SetupCompilationOptions } from './setup-compilation';

vi.mock('./setup-compilation', () => ({
  setupCompilation: vi.fn().mockResolvedValue({
    rootNames: ['/root/src/main.ts'],
    compilerOptions: {},
    componentStylesheetBundler: {},
  }),
  styleTransform: vi.fn(() => async () => ({ contents: '' })),
}));

describe('setupCompilationWithAngularCompilation', () => {
  const options: SetupCompilationOptions = {
    root: '/root',
    tsConfig: '/root/tsconfig.json',
    aot: true,
    inlineStyleLanguage: 'css',
    fileReplacements: [],
  };

  it('should propagate initialization errors', async () => {
    const angularCompilation = {
      initialize: vi
        .fn()
        .mockRejectedValue(new Error('TS version not supported')),
    } as unknown as AngularCompilation;

    await expect(
      setupCompilationWithAngularCompilation(
        { source: { tsconfigPath: '/root/tsconfig.json' } },
        options,
        undefined,
        angularCompilation
      )
    ).rejects.toThrow('TS version not supported');
  });

  it('should set referenced files on the source file cache', async () => {
    const angularCompilation = {
      initialize: vi
        .fn()
        .mockResolvedValue({ referencedFiles: ['/root/src/main.ts'] }),
    } as unknown as AngularCompilation;
    const sourceFileCache = {} as SourceFileCache;

    const result = await setupCompilationWithAngularCompilation(
      { source: { tsconfigPath: '/root/tsconfig.json' } },
      options,
      sourceFileCache,
      angularCompilation
    );

    expect(sourceFileCache.referencedFiles).toEqual(['/root/src/main.ts']);
    expect(result.angularCompilation).toBe(angularCompilation);
  });
});
