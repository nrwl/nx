import { describe, expect, vi, it } from 'vitest';
import { SourceFileCache } from './source-file-cache.ts';
import { pathToFileURL } from 'node:url';
import * as osModule from 'node:os';
import path from 'node:path';
import type ts from 'typescript';

vi.mock('node:os', async (importOriginal) => {
  const actual = await importOriginal<typeof osModule>();

  return {
    ...actual,
    platform: vi.fn(),
  };
});

describe('SourceFileCache', async () => {
  it('should maintain get, set and invalidate', () => {
    const { set, has, get, invalidate } = new SourceFileCache();

    expect(has).toStrictEqual(expect.any(Function));
    expect(set).toStrictEqual(expect.any(Function));
    expect(get).toStrictEqual(expect.any(Function));
    expect(invalidate).toStrictEqual(expect.any(Function));
  });

  it('should normalize windows file path to unix format if platform is win32', () => {
    const platformSpy = vi.spyOn(osModule, 'platform').mockReturnValue('win32');
    const cache = new SourceFileCache();
    const fileName = `path${path.win32.sep}to${path.win32.sep}index.ts`;

    expect(() => cache.invalidate([fileName])).not.toThrow();
    expect(platformSpy).toHaveBeenCalledTimes(1);
    expect([...cache.modifiedFiles]).toStrictEqual(['path/to/index.ts']);
  });

  it('should keep unix format for file path if platform is win32', () => {
    const platformSpy = vi.spyOn(osModule, 'platform').mockReturnValue('win32');
    const cache = new SourceFileCache();
    const fileName = `path/to/index.ts`;

    expect(() => cache.invalidate([fileName])).not.toThrow();
    expect(platformSpy).toHaveBeenCalledTimes(1);
    expect([...cache.modifiedFiles]).toStrictEqual([fileName]);
  });

  it('should keep unix format if platform is not windows', () => {
    const platformSpy = vi.spyOn(osModule, 'platform').mockReturnValue('linux');
    const cache = new SourceFileCache();
    const fileName = `path/to/index.ts`;

    expect(() => cache.invalidate([fileName])).not.toThrow();
    expect(platformSpy).toHaveBeenCalledTimes(1);
    expect([...cache.modifiedFiles]).toStrictEqual([fileName]);
  });

  it('should keep windows format if platform is not windows', () => {
    const platformSpy = vi.spyOn(osModule, 'platform').mockReturnValue('linux');
    const cache = new SourceFileCache();
    const fileName = `path${path.win32.sep}to${path.win32.sep}index.ts`;

    expect(() => cache.invalidate([fileName])).not.toThrow();
    expect(platformSpy).toHaveBeenCalledTimes(1);
    expect([...cache.modifiedFiles]).toStrictEqual([fileName]);
  });

  it('should invalidate and delete all files form the top-level cache API', () => {
    const cache = new SourceFileCache();
    const cacheDeleteSpy = vi.spyOn(cache, 'delete');
    const fileName = 'index.ts';

    expect(() => cache.invalidate([fileName])).not.toThrow();
    expect(cacheDeleteSpy).toHaveBeenCalledTimes(1);
    expect(cacheDeleteSpy).toHaveBeenCalledWith(fileName);
    expect(cache.get(fileName)).toBeUndefined();
  });

  it('should invalidate and delete all files by their href form typeScriptFileCache', () => {
    const cache = new SourceFileCache();
    const typeScriptFileCacheDeleteSpy = vi.spyOn(
      cache.typeScriptFileCache,
      'delete'
    );
    const fileName = 'index.ts';

    expect(() => cache.invalidate([fileName])).not.toThrow();
    expect(typeScriptFileCacheDeleteSpy).toHaveBeenCalledTimes(1);
    expect(typeScriptFileCacheDeleteSpy).toHaveBeenCalledWith(
      pathToFileURL(fileName).href
    );
  });

  it('should invalidate and delete all files form babelFileCache', () => {
    const cache = new SourceFileCache();
    const babelFileCacheDeleteSpy = vi.spyOn(cache.babelFileCache, 'delete');
    const fileName = 'index.ts';

    expect(() => cache.invalidate([fileName])).not.toThrow();
    expect(babelFileCacheDeleteSpy).toHaveBeenCalledTimes(1);
    expect(babelFileCacheDeleteSpy).toHaveBeenCalledWith(fileName);
  });

  it('should invalidate and add the file to modifiedFiles', () => {
    const cache = new SourceFileCache();
    const modifiedFilesAddSpy = vi.spyOn(cache.modifiedFiles, 'add');
    const fileName = 'index.ts';

    expect(() => cache.invalidate([fileName])).not.toThrow();
    expect(modifiedFilesAddSpy).toHaveBeenCalledTimes(1);
    expect(modifiedFilesAddSpy).toHaveBeenCalledWith(fileName);

    expect(cache.modifiedFiles.size).toBe(1);
  });

  it('should invalidate and clear modifiedFiles if the passed files are not equal to the modifiedFiles', () => {
    const cache = new SourceFileCache();
    const modifiedFilesClearSpy = vi.spyOn(cache.modifiedFiles, 'clear');
    const fileName = 'index.ts';

    cache.modifiedFiles.add('other.ts');
    cache.modifiedFiles.add('internal.ts');
    expect(cache.modifiedFiles.size).toBe(2);

    expect(() => cache.invalidate([fileName])).not.toThrow();
    expect(modifiedFilesClearSpy).toHaveBeenCalledTimes(1);
  });

  it('should invalidate and keep modifiedFiles if the passed files are equal to the modifiedFiles', () => {
    const cache = new SourceFileCache();
    const modifiedFilesSpy = vi.spyOn(cache.modifiedFiles, 'clear');

    expect(() => cache.invalidate(cache.modifiedFiles)).not.toThrow();
    expect(modifiedFilesSpy).toHaveBeenCalledTimes(0);
  });
});
