import { jsonDiff, DiffType } from './json-diff';

describe('jsonDiff', () => {
  it('should return deep diffs of two JSON objects', () => {
    const result = jsonDiff(
      { x: 1, a: { b: { c: 1 } } },
      { y: 2, a: { b: { c: 2, d: 2 } } }
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
        },
        {
          type: DiffType.Added,
          path: ['a', 'b', 'd'],
          value: { lhs: undefined, rhs: 2 }
        }
      ])
    );
  });

  it('should work well for package.json', () => {
    const result = jsonDiff(
      {
        dependencies: {
          'happy-nrwl': '0.0.1',
          'not-awesome-nrwl': '0.0.1'
        }
      },
      {
        dependencies: {
          'happy-nrwl': '0.0.2',
          'awesome-nrwl': '0.0.1'
        }
      }
    );

    expect(result).toContainEqual({
      type: DiffType.Modified,
      path: ['dependencies', 'happy-nrwl'],
      value: { lhs: '0.0.1', rhs: '0.0.2' }
    });

    expect(result).toContainEqual({
      type: DiffType.Deleted,
      path: ['dependencies', 'not-awesome-nrwl'],
      value: { lhs: '0.0.1', rhs: undefined }
    });

    expect(result).toContainEqual({
      type: DiffType.Added,
      path: ['dependencies', 'awesome-nrwl'],
      value: { lhs: undefined, rhs: '0.0.1' }
    });
  });
});
