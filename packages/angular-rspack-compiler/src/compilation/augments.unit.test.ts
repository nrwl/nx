import { beforeEach, describe, expect, MockInstance } from 'vitest';
import { augmentHostWithCaching, augmentHostWithResources } from './augments';
import ts, { createCompilerHost } from 'typescript';

describe('augmentHostWithCaching', () => {
  const cache = new Map<string, ts.SourceFile>();
  const cacheHasSpy: MockInstance<[string], boolean> = vi.spyOn(cache, 'has');
  const cacheSetSpy: MockInstance<[string, ts.SourceFile]> = vi.spyOn(
    cache,
    'set'
  );
  const cacheGetSpy: MockInstance<[string]> = vi.spyOn(cache, 'get');

  beforeEach(() => {
    cache.clear();
    vi.clearAllMocks();
  });

  it('should check the passed cache if augmented', () => {
    const host = createCompilerHost({});

    expect(() =>
      host.getSourceFile('not-existing', ts.ScriptTarget.ES5)
    ).not.toThrow();
    expect(cacheHasSpy).not.toHaveBeenCalled();

    expect(() => augmentHostWithCaching(host, cache)).not.toThrow();

    expect(() =>
      host.getSourceFile('not-existing', ts.ScriptTarget.ES5)
    ).not.toThrow();
    expect(cacheHasSpy).toHaveBeenCalledTimes(1);
    expect(cacheSetSpy).toHaveBeenCalledTimes(0);
    expect(cacheGetSpy).toHaveBeenCalledTimes(0);
  });

  it('should return from cache if cache hit', () => {
    const host = createCompilerHost({});
    const filename = 'cached-file.ts';
    const file = ts.createSourceFile(
      filename,
      'content of cached-file.ts',
      ts.ScriptTarget.ES5
    );
    cache.set(filename, file);
    cacheSetSpy.mockClear();

    expect(() => augmentHostWithCaching(host, cache)).not.toThrow();

    expect(host.getSourceFile(filename, ts.ScriptTarget.ES5)).toBe(file);

    expect(cacheHasSpy).toHaveBeenCalledTimes(1);
    expect(cacheGetSpy).toHaveBeenCalledTimes(1);
    expect(cacheSetSpy).toHaveBeenCalledTimes(0);
  });

  it('should load and return from cache if cache miss', () => {
    const host = createCompilerHost({});
    const filename = 'uncached-file.ts';
    const file = ts.createSourceFile(
      filename,
      'content of uncached-file.ts',
      ts.ScriptTarget.ES5
    );
    const getSourceFileSpy = vi
      .spyOn(host, 'getSourceFile')
      .mockReturnValueOnce(file);

    expect(() => augmentHostWithCaching(host, cache)).not.toThrow();

    expect(host.getSourceFile(filename, ts.ScriptTarget.ES5)).toBe(file);

    expect(cacheHasSpy).toHaveBeenCalledTimes(1);
    expect(cacheGetSpy).toHaveBeenCalledTimes(0);
    expect(cacheSetSpy).toHaveBeenCalledTimes(1);
    expect(getSourceFileSpy).toHaveBeenCalledTimes(1);
  });
});

describe('augmentHostWithResources', () => {
  const transform = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should add readResource and transformResource to host', () => {
    const host = createCompilerHost({});

    expect(host).toStrictEqual(
      expect.not.objectContaining({
        readResource: expect.any(Function),
        transformResource: expect.any(Function),
      })
    );

    expect(() => augmentHostWithResources(host, transform, {})).not.toThrow();

    expect(host).toStrictEqual(
      expect.objectContaining({
        readResource: expect.any(Function),
        transformResource: expect.any(Function),
      })
    );
  });
});
