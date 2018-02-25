import { addApp } from './fileutils';

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
      expect(addApp([{ name: 'a' }, { name: 'z' }], { name: '$workspaceRoot' })).toEqual([
        { name: 'a' },
        { name: 'z' },
        { name: '$workspaceRoot' }
      ]);
    });

    it('should prioritize apps with "main" defined', () => {
      expect(
        addApp([{ name: 'c' }, { name: 'a' }, { name: 'a', main: 'a' }], {
          name: 'b',
          main: 'b'
        })
      ).toEqual([{ name: 'a', main: 'a' }, { name: 'b', main: 'b' }, { name: 'a' }, { name: 'c' }]);
    });
  });
});
