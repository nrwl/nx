import type { LoaderContext } from '@rspack/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NG_RSPACK_SYMBOL_NAME, type NgRspackCompilation } from '../../models';
import { default as angularTransformLoader } from './angular-transform.loader';
import { toTypeScriptFileCacheKey } from '@nx/angular-rspack-compiler';

// Simulate Windows path semantics regardless of the host platform: the
// loader and the cache-key helper resolve `node:path` to the win32
// implementation.
vi.mock('node:path', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:path')>();
  return {
    ...actual.win32,
    win32: actual.win32,
    posix: actual.posix,
    default: { ...actual.win32, win32: actual.win32, posix: actual.posix },
  };
});

describe('angular-transform.loader (windows)', () => {
  const callback = vi.fn();
  const addDependency = vi.fn();
  const typescriptFileCache = new Map<string, string>();
  const javascriptTransformer = {
    transformData: vi.fn(),
  };
  const thisValue = {
    async: vi.fn(() => callback),
  } as unknown as LoaderContext<unknown>;

  beforeEach(() => {
    vi.clearAllMocks();
    typescriptFileCache.clear();
  });

  it('should register compiler-tracked resource dependencies with native separators', () => {
    // The compiler reports resource dependency paths with POSIX separators
    // on Windows; the map is keyed like the emit cache.
    const resourceDependencies = new Map([
      [
        toTypeScriptFileCacheKey('C:/proj/src/app/app.component.ts'),
        [
          'C:/proj/src/app/app.component.html',
          'C:/proj/src/app/app.component.css',
        ],
      ],
    ]);

    angularTransformLoader.call(
      {
        ...thisValue,
        _compilation: {
          [NG_RSPACK_SYMBOL_NAME]: () => ({
            typescriptFileCache,
            javascriptTransformer,
            useTypeScriptTranspilation: true,
            resourceDependencies,
          }),
        } as unknown as NgRspackCompilation,
        resourcePath: 'C:\\proj\\src\\app\\app.component.ts',
        addDependency,
      },
      '@Component()'
    );

    expect(addDependency).toHaveBeenCalledTimes(2);
    expect(addDependency).toHaveBeenNthCalledWith(
      1,
      'C:\\proj\\src\\app\\app.component.html'
    );
    expect(addDependency).toHaveBeenNthCalledWith(
      2,
      'C:\\proj\\src\\app\\app.component.css'
    );
  });
});
