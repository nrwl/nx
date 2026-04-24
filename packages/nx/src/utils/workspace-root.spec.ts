import * as path from 'path';
import * as fileUtils from './fileutils';
import { workspaceRootInner } from './workspace-root';

type FileTree = {
  files?: string[];
  [path: string]: string[] | FileTree;
};

const rootMarkers = ['nx.json', 'nx', 'nx.bat'];

describe('workspaceRootInner', () => {
  // The global unit-test setup sets NX_WORKSPACE_ROOT_PATH to point Nx at a
  // throwaway dir so tests never walk the real repo. `workspaceRootInner`
  // short-circuits on that env var, so clear it here to exercise the actual
  // root-detection logic this suite is testing.
  let originalWorkspaceRootPath: string | undefined;
  beforeAll(() => {
    originalWorkspaceRootPath = process.env.NX_WORKSPACE_ROOT_PATH;
    delete process.env.NX_WORKSPACE_ROOT_PATH;
  });
  afterAll(() => {
    if (originalWorkspaceRootPath === undefined) {
      delete process.env.NX_WORKSPACE_ROOT_PATH;
    } else {
      process.env.NX_WORKSPACE_ROOT_PATH = originalWorkspaceRootPath;
    }
  });

  it.each(rootMarkers)('should find workspace root from %s', (marker) => {
    jest
      .spyOn(fileUtils, 'fileExists')
      .mockImplementation((p) =>
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
      jest
        .spyOn(fileUtils, 'fileExists')
        .mockImplementation((p) =>
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
      jest
        .spyOn(fileUtils, 'fileExists')
        .mockImplementation((p) =>
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
    jest
      .spyOn(fileUtils, 'fileExists')
      .mockImplementation((p) =>
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
    jest
      .spyOn(fileUtils, 'fileExists')
      .mockImplementation((p) =>
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
