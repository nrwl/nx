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

  it('should find workspace root from package.json with nx dependency', () => {
    jest
      .spyOn(fileUtils, 'fileExists')
      .mockImplementation((p) =>
        ['/home/workspace/package.json'].includes(p.toString())
      );
    jest.spyOn(fileUtils, 'readJsonFile').mockImplementation((path) => {
      if (path === '/home/workspace/package.json') {
        return {
          name: 'my-workspace',
          dependencies: {
            nx: '^17.0.0',
          },
        };
      }
      throw new Error('File not found');
    });

    expect(workspaceRootInner('/home/workspace', null)).toEqual(
      '/home/workspace'
    );
  });

  it('should find workspace root from package.json with nx devDependency', () => {
    jest
      .spyOn(fileUtils, 'fileExists')
      .mockImplementation((p) =>
        ['/home/workspace/package.json'].includes(p.toString())
      );
    jest.spyOn(fileUtils, 'readJsonFile').mockImplementation((path) => {
      if (path === '/home/workspace/package.json') {
        return {
          name: 'my-workspace',
          devDependencies: {
            nx: '^17.0.0',
          },
        };
      }
      throw new Error('File not found');
    });

    expect(workspaceRootInner('/home/workspace', null)).toEqual(
      '/home/workspace'
    );
  });

  it('should find workspace root from package.json with nx peerDependency', () => {
    jest
      .spyOn(fileUtils, 'fileExists')
      .mockImplementation((p) =>
        ['/home/workspace/package.json'].includes(p.toString())
      );
    jest.spyOn(fileUtils, 'readJsonFile').mockImplementation((path) => {
      if (path === '/home/workspace/package.json') {
        return {
          name: 'my-workspace',
          peerDependencies: {
            nx: '^17.0.0',
          },
        };
      }
      throw new Error('File not found');
    });

    expect(workspaceRootInner('/home/workspace', null)).toEqual(
      '/home/workspace'
    );
  });

  it('should continue search if package.json exists but has no nx dependency', () => {
    jest
      .spyOn(fileUtils, 'fileExists')
      .mockImplementation((p) =>
        [
          '/home/workspace/package.json',
          '/home/node_modules/nx/package.json',
        ].includes(p.toString())
      );
    jest.spyOn(fileUtils, 'readJsonFile').mockImplementation((path) => {
      if (path === '/home/workspace/package.json') {
        return {
          name: 'my-workspace',
          dependencies: {
            react: '^18.0.0',
          },
        };
      }
      throw new Error('File not found');
    });

    expect(workspaceRootInner('/home/workspace', null)).toEqual('/home');
  });

  it('should continue search if package.json cannot be read', () => {
    jest
      .spyOn(fileUtils, 'fileExists')
      .mockImplementation((p) =>
        [
          '/home/workspace/package.json',
          '/home/node_modules/nx/package.json',
        ].includes(p.toString())
      );
    jest.spyOn(fileUtils, 'readJsonFile').mockImplementation(() => {
      throw new Error('Cannot read file');
    });

    expect(workspaceRootInner('/home/workspace', null)).toEqual('/home');
  });
});
