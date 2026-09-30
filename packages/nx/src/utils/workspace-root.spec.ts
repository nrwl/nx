import * as path from 'path';
import * as fileUtils from './fileutils';
import { workspaceRootInner } from './workspace-root';

type FileTree = {
  files?: string[];
  [path: string]: string[] | FileTree;
};

const rootMarkers = ['nx.json', 'nx', 'nx.bat'];

describe('workspaceRootInner', () => {
  it.each(rootMarkers)('should find workspace root from %s', (marker) => {
    vi.spyOn(fileUtils, 'fileExists').mockImplementation((p) =>
      [
        `/home/workspace/${marker}`,
        '/home/workspace/packages/a/package.json',
        '/home/workspace/packages/b/package.json',
        '/home/workspace/packages/c/package.json',
      ].includes(p.toString())
    );

    expect(workspaceRootInner('/home/workspace', null)).toEqual(
      '/home/workspace'
    );
  });

  it.each(rootMarkers)(
    'should find workspace root from %s when in subpackage',
    (marker) => {
      vi.spyOn(fileUtils, 'fileExists').mockImplementation((p) =>
        [
          `/home/workspace/${marker}`,
          '/home/workspace/packages/a/package.json',
          '/home/workspace/packages/b/package.json',
          '/home/workspace/packages/c/package.json',
        ].includes(p.toString())
      );

      expect(workspaceRootInner('/home/workspace/packages/a', null)).toEqual(
        '/home/workspace'
      );
    }
  );

  it.each(rootMarkers)(
    'should prefer workspace root from %s when in subpackage containing nx',
    (marker) => {
      vi.spyOn(fileUtils, 'fileExists').mockImplementation((p) =>
        [
          `/home/workspace/${marker}`,
          '/home/workspace/packages/a/node_modules/nx/package.json',
          '/home/workspace/packages/a/package.json',
          '/home/workspace/packages/b/package.json',
          '/home/workspace/packages/c/package.json',
        ].includes(p.toString())
      );

      expect(workspaceRootInner('/home/workspace/packages/a', null)).toEqual(
        '/home/workspace'
      );
    }
  );

  it('should find workspace root from installation when marker not present', () => {
    vi.spyOn(fileUtils, 'fileExists').mockImplementation((p) =>
      [
        `/home/workspace/node_modules/nx/package.json`,
        '/home/workspace/packages/a/package.json',
        '/home/workspace/packages/b/package.json',
        '/home/workspace/packages/c/package.json',
      ].includes(p.toString())
    );

    expect(workspaceRootInner('/home/workspace/packages/a', null)).toEqual(
      '/home/workspace'
    );
  });

  it('should prefer outer workspace root from installation when marker not present and nested', () => {
    vi.spyOn(fileUtils, 'fileExists').mockImplementation((p) =>
      [
        `/home/workspace/node_modules/nx/package.json`,
        '/home/workspace/packages/a/node_modules/nx/package.json',
        '/home/workspace/packages/a/package.json',
        '/home/workspace/packages/b/package.json',
        '/home/workspace/packages/c/package.json',
      ].includes(p.toString())
    );

    expect(workspaceRootInner('/home/workspace/packages/a', null)).toEqual(
      '/home/workspace'
    );
  });
});
