// This must come before the Hasher import

import { expandNamedInput, filterUsingGlobPatterns } from './task-hasher';

describe('TaskHasher', () => {
  describe('expandNamedInput', () => {
    it('should expand named inputs', () => {
      const expanded = expandNamedInput('c', {
        a: ['a.txt', { fileset: 'myfileset' }],
        b: ['b.txt'],
        c: ['a', { input: 'b' }],
      });
      expect(expanded).toEqual([
        { fileset: 'a.txt' },
        { fileset: 'myfileset' },
        { fileset: 'b.txt' },
      ]);
    });

    it('should throw when an input is not defined"', () => {
      expect(() => expandNamedInput('c', {})).toThrow();
      expect(() =>
        expandNamedInput('b', {
          b: [{ input: 'c' }],
        })
      ).toThrow();
    });

    it('should throw when ^ is used', () => {
      expect(() =>
        expandNamedInput('b', {
          b: ['^c'],
        })
      ).toThrowError('namedInputs definitions cannot start with ^');
    });

    it('should treat strings as filesets when no matching inputs', () => {
      const expanded = expandNamedInput('b', {
        b: ['c'],
      });
      expect(expanded).toEqual([{ fileset: 'c' }]);
    });
  });

  describe('filterUsingGlobPatterns', () => {
    it('should OR all positive patterns and AND all negative patterns (when positive and negative patterns)', () => {
      const filtered = filterUsingGlobPatterns(
        'root',
        [
          { file: 'root/a.ts' },
          { file: 'root/b.js' },
          { file: 'root/c.spec.ts' },
          { file: 'root/d.md' },
        ] as any,
        [
          '{projectRoot}/**/*.ts',
          '{projectRoot}/**/*.js',
          '!{projectRoot}/**/*.spec.ts',
          '!{projectRoot}/**/*.md',
        ]
      );

      expect(filtered.map((f) => f.file)).toEqual(['root/a.ts', 'root/b.js']);
    });

    it('should OR all positive patterns and AND all negative patterns (when negative patterns)', () => {
      const filtered = filterUsingGlobPatterns(
        'root',
        [
          { file: 'root/a.ts' },
          { file: 'root/b.js' },
          { file: 'root/c.spec.ts' },
          { file: 'root/d.md' },
        ] as any,
        ['!{projectRoot}/**/*.spec.ts', '!{projectRoot}/**/*.md']
      );

      expect(filtered.map((f) => f.file)).toEqual(['root/a.ts', 'root/b.js']);
    });

    it('should OR all positive patterns and AND all negative patterns (when positive patterns)', () => {
      const filtered = filterUsingGlobPatterns(
        'root',
        [
          { file: 'root/a.ts' },
          { file: 'root/b.js' },
          { file: 'root/c.spec.ts' },
          { file: 'root/d.md' },
        ] as any,
        ['{projectRoot}/**/*.ts', '{projectRoot}/**/*.js']
      );

      expect(filtered.map((f) => f.file)).toEqual([
        'root/a.ts',
        'root/b.js',
        'root/c.spec.ts',
      ]);
    });

    it('should handle projects with the root set to .', () => {
      const filtered = filterUsingGlobPatterns(
        '.',
        [
          { file: 'a.ts' },
          { file: 'b.md' },
          { file: 'dir/a.ts' },
          { file: 'dir/b.md' },
        ] as any,
        ['{projectRoot}/**/*.ts', '!{projectRoot}/**/*.md']
      );

      expect(filtered.map((f) => f.file)).toEqual(['a.ts', 'dir/a.ts']);
    });
  });
});
