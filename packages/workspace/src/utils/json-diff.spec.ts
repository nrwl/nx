import { jsonDiff, DiffType } from './json-diff';

describe('jsonDiff', () => {
  it('should return deep diffs of two JSON objects', () => {
    const result = jsonDiff(
      { x: 1, a: { b: { c: 1 } } },
      { y: 2, a: { b: { c: 2 } } }
    );

    expect(result).toEqual(
      expect.arrayContaining([
        {
          type: DiffType.Modified,
          path: ['a', 'b', 'c'],
          value: { lhs: 1, rhs: 2 }
        },
        {
          type: DiffType.Deleted,
          path: ['x'],
          value: { lhs: 1, rhs: undefined }
        },
        {
          type: DiffType.Added,
          path: ['y'],
          value: { lhs: undefined, rhs: 2 }
        }
      ])
    );
  });
});
