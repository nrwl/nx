import { normalize } from 'node:path';
import type ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { SourceFileCache, toTypeScriptFileCacheKey } from './source-file-cache';

describe('SourceFileCache', () => {
  it('should drop cached source files and track modified files on invalidate', () => {
    const cache = new SourceFileCache();
    cache.set(normalize('/root/src/main.ts'), {} as ts.SourceFile);
    cache.set(normalize('/root/src/other.ts'), {} as ts.SourceFile);

    cache.invalidate(['/root/src/main.ts']);

    expect(cache.has(normalize('/root/src/main.ts'))).toBe(false);
    expect(cache.has(normalize('/root/src/other.ts'))).toBe(true);
    expect(cache.modifiedFiles).toEqual(
      new Set([normalize('/root/src/main.ts')])
    );
  });

  it('should not evict emitted output on invalidate', () => {
    const cache = new SourceFileCache();
    cache.typeScriptFileCache.set(
      toTypeScriptFileCacheKey('/root/src/main.ts'),
      'raw emit'
    );

    cache.invalidate(['/root/src/main.ts']);

    // A fresh emit overwrites the entry; invalidating must not drop it, or
    // files that are not re-emitted would lose their compiled output.
    expect(
      cache.typeScriptFileCache.get(
        toTypeScriptFileCacheKey('/root/src/main.ts')
      )
    ).toBe('raw emit');
  });

  it('should evict transformed package code on invalidate', () => {
    const cache = new SourceFileCache();
    cache.babelFileCache.set(
      toTypeScriptFileCacheKey('/root/dist/lib/index.mjs'),
      { code: 'transformed', map: undefined, chainedMap: undefined }
    );

    cache.invalidate(['/root/dist/lib/index.mjs']);

    // Files outside the Angular compilation are never re-emitted, so a
    // modification must drop the cached transform.
    expect(
      cache.babelFileCache.has(
        toTypeScriptFileCacheKey('/root/dist/lib/index.mjs')
      )
    ).toBe(false);
  });

  it('should evict emitted output for removed files on prune', () => {
    const cache = new SourceFileCache();
    cache.typeScriptFileCache.set(
      toTypeScriptFileCacheKey('/root/src/removed.ts'),
      'raw emit'
    );
    cache.typeScriptFileCache.set(
      toTypeScriptFileCacheKey('/root/src/kept.ts'),
      'raw emit'
    );
    cache.babelFileCache.set(toTypeScriptFileCacheKey('/root/src/removed.ts'), {
      code: 'transformed',
      map: undefined,
      chainedMap: undefined,
    });

    cache.prune(['/root/src/removed.ts']);

    expect(
      cache.babelFileCache.has(toTypeScriptFileCacheKey('/root/src/removed.ts'))
    ).toBe(false);

    expect(
      cache.typeScriptFileCache.has(
        toTypeScriptFileCacheKey('/root/src/removed.ts')
      )
    ).toBe(false);
    expect(
      cache.typeScriptFileCache.has(
        toTypeScriptFileCacheKey('/root/src/kept.ts')
      )
    ).toBe(true);
  });

  it('should strip the Windows drive letter from cache keys', () => {
    expect(toTypeScriptFileCacheKey('C:/root/src/main.ts')).toBe(
      normalize('/root/src/main.ts')
    );
  });
});
