import type { JavaScriptTransformer } from '@angular/build/private';
import { normalize } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AngularCompilation } from '../models';
import type { TransformedSource } from '../utils/source-file-cache';
import { buildAndAnalyze } from './build-and-analyze';

vi.mock('../utils/assert-supported-versions', () => ({
  assertSupportedAngularRspackCompilerVersions: vi.fn(),
}));

describe('buildAndAnalyze', () => {
  const transformData = vi.fn();
  const javascriptTransformer = {
    transformData,
  } as unknown as JavaScriptTransformer;
  let typescriptFileCache: Map<string, string | TransformedSource>;

  const compilationWithEmit = (
    files: Array<{ filename: string; contents: string | Uint8Array }>
  ) =>
    ({
      emitAffectedFiles: vi.fn().mockResolvedValue(files),
    }) as unknown as AngularCompilation;

  beforeEach(() => {
    vi.clearAllMocks();
    typescriptFileCache = new Map();
  });

  it('should store the raw emit without transforming it eagerly', async () => {
    const compilation = compilationWithEmit([
      { filename: '/root/src/main.ts', contents: 'emitted js' },
    ]);

    await buildAndAnalyze(
      compilation,
      typescriptFileCache,
      javascriptTransformer
    );

    expect(typescriptFileCache.get('/root/src/main.ts')).toBe('emitted js');
    expect(transformData).not.toHaveBeenCalled();
  });

  it('should replace a stale transformed entry with the new raw emit', async () => {
    typescriptFileCache.set('/root/src/main.ts', {
      code: 'old transformed',
      map: undefined,
    });
    const compilation = compilationWithEmit([
      { filename: '/root/src/main.ts', contents: 'new emit' },
    ]);

    await buildAndAnalyze(
      compilation,
      typescriptFileCache,
      javascriptTransformer
    );

    expect(typescriptFileCache.get('/root/src/main.ts')).toBe('new emit');
  });

  it('should decode binary emit contents to text', async () => {
    const compilation = compilationWithEmit([
      {
        filename: '/root/src/messages.json',
        contents: new TextEncoder().encode('{"a":1}'),
      },
    ]);

    await buildAndAnalyze(
      compilation,
      typescriptFileCache,
      javascriptTransformer
    );

    expect(typescriptFileCache.get('/root/src/messages.json')).toBe('{"a":1}');
  });

  it('should strip the Windows drive letter from the cache key', async () => {
    const compilation = compilationWithEmit([
      { filename: 'C:/root/src/main.ts', contents: 'emitted js' },
    ]);

    await buildAndAnalyze(
      compilation,
      typescriptFileCache,
      javascriptTransformer
    );

    expect(typescriptFileCache.get(normalize('/root/src/main.ts'))).toBe(
      'emitted js'
    );
  });
});
