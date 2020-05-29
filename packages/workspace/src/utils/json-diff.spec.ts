import { jsonDiff, DiffType } from './json-diff';

describe('jsonDiff', () => {
  it('should return deep diffs of two JSON objects (including parents of children changes)', () => {
    const result = jsonDiff(
      { x: 1, a: { b: { c: 1 } } },
      { y: 2, a: { b: { c: 2, d: 2 } } }
    );

    expect(result).toEqual(
      expect.arrayContaining([
        {
          type: DiffType.Modified,
          path: ['a'],
          value: {
            lhs: {
              b: {
                c: 1,
              },
            },
            rhs: {
              b: {
                c: 2,
                d: 2,
              },
            },
          },
        },
        {
          type: DiffType.Modified,
          path: ['a', 'b'],
          value: {
            lhs: {
              c: 1,
            },
            rhs: {
              c: 2,
              d: 2,
            },
          },
        },
        {
          type: DiffType.Modified,
          path: ['a', 'b', 'c'],
          value: { lhs: 1, rhs: 2 },
        },
        {
          type: DiffType.Deleted,
          path: ['x'],
          value: { lhs: 1, rhs: undefined },
        },
        {
          type: DiffType.Added,
          path: ['y'],
          value: { lhs: undefined, rhs: 2 },
        },
        {
          type: DiffType.Added,
          path: ['a', 'b', 'd'],
          value: { lhs: undefined, rhs: 2 },
        },
      ])
    );
  });

  it('should have diffs for objects as well', () => {
    const result = jsonDiff(
      {
        a: { b: 0 },
      },

      {
        a: { b: 1 },
      }
    );
    expect(result).toContainEqual({
      type: DiffType.Modified,
      path: ['a'],
      value: {
        lhs: {
          b: 0,
        },
        rhs: {
          b: 1,
        },
      },
    });
    expect(result).toContainEqual({
      type: DiffType.Modified,
      path: ['a', 'b'],
      value: {
        lhs: 0,
        rhs: 1,
      },
    });

    const result2 = jsonDiff(
      {},

      {
        a: {},
      }
    );
    expect(result2).toContainEqual({
      type: DiffType.Added,
      path: ['a'],
      value: { lhs: undefined, rhs: {} },
    });
  });

  it('should work for added array values', () => {
    const result = jsonDiff(
      {
        rules: undefined,
      },
      {
        rules: ['rule1'],
      }
    );

    expect(result).toEqual(
      expect.arrayContaining([
        {
          type: DiffType.Modified,
          path: ['rules'],
          value: {
            lhs: undefined,
            rhs: ['rule1'],
          },
        },
        {
          type: DiffType.Added,
          path: ['rules', '0'],
          value: {
            lhs: undefined,
            rhs: 'rule1',
          },
        },
      ])
    );
  });

  it('should work for added array items', () => {
    const result = jsonDiff(
      {
        rules: ['rule1'],
      },
      {
        rules: ['rule1', 'rule2'],
      }
    );

    expect(result).toEqual(
      expect.arrayContaining([
        {
          type: DiffType.Modified,
          path: ['rules'],
          value: {
            lhs: ['rule1'],
            rhs: ['rule1', 'rule2'],
          },
        },
        {
          type: DiffType.Added,
          path: ['rules', '1'],
          value: {
            lhs: undefined,
            rhs: 'rule2',
          },
        },
      ])
    );
  });

  it('should work well for package.json', () => {
    const result = jsonDiff(
      {
        dependencies: {
          'happy-nrwl': '0.0.1',
          'not-awesome-nrwl': '0.0.1',
        },
      },
      {
        dependencies: {
          'happy-nrwl': '0.0.2',
          'awesome-nrwl': '0.0.1',
        },
      }
    );

    expect(result).toContainEqual({
      type: DiffType.Modified,
      path: ['dependencies', 'happy-nrwl'],
      value: { lhs: '0.0.1', rhs: '0.0.2' },
    });

    expect(result).toContainEqual({
      type: DiffType.Deleted,
      path: ['dependencies', 'not-awesome-nrwl'],
      value: { lhs: '0.0.1', rhs: undefined },
    });

    expect(result).toContainEqual({
      type: DiffType.Added,
      path: ['dependencies', 'awesome-nrwl'],
      value: { lhs: undefined, rhs: '0.0.1' },
    });
  });
});
