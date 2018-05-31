import { addApp, createDirectory } from './fileutils';

import * as fs from 'fs';

describe('fileutils', () => {
  describe('sortApps', () => {
    it('should handle undefined', () => {
      expect(addApp(undefined, { name: 'a' })).toEqual([{ name: 'a' }]);
    });

    it('should handle an empty array', () => {
      expect(addApp([], { name: 'a' })).toEqual([{ name: 'a' }]);
    });

    it('should sort apps by name', () => {
      expect(addApp([{ name: 'a' }, { name: 'b' }], { name: 'c' })).toEqual([
        { name: 'a' },
        { name: 'b' },
        { name: 'c' }
      ]);
    });

    it('should put workspaceRoot last', () => {
      expect(
        addApp([{ name: 'a' }, { name: 'z' }], { name: '$workspaceRoot' })
      ).toEqual([{ name: 'a' }, { name: 'z' }, { name: '$workspaceRoot' }]);
    });

    it('should prioritize apps with "main" defined', () => {
      expect(
        addApp([{ name: 'c' }, { name: 'a' }, { name: 'a', main: 'a' }], {
          name: 'b',
          main: 'b'
        })
      ).toEqual([
        { name: 'a', main: 'a' },
        { name: 'b', main: 'b' },
        { name: 'a' },
        { name: 'c' }
      ]);
    });
  });

  describe('createDirectory', () => {
    let fakeExistingDirectories: Set<string>;

    beforeEach(() => {
      fakeExistingDirectories = new Set<string>();
      fakeExistingDirectories.add('/a');
      spyOn(fs, 'mkdirSync').and.callFake(path => {
        fakeExistingDirectories.add(path);
      });
      spyOn(fs, 'statSync').and.callFake(path => {
        return {
          isDirectory: () => fakeExistingDirectories.has(path)
        };
      });
    });

    it('should recursively create the directory', () => {
      createDirectory('/a/b/c');
      const expectedSet = new Set<string>(['/a', '/a/b', '/a/b/c']);
      expect(fakeExistingDirectories).toEqual(expectedSet);
    });
  });
});
