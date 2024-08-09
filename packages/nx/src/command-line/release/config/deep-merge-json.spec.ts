import { deepMergeJson } from './deep-merge-json';

describe('deepMergeJson()', () => {
  it('should merge two JSON objects', () => {
    const target = {
      a: 1,
      b: {
        c: 2,
        d: {
          e: [1, 2, 3, 4, 5, 6],
          f: true,
          g: false,
          h: '',
          i: null,
        },
      },
    };
    const source = {
      a: 3,
      b: {
        c: 4,
        d: {
          e: [4, 5, 6, 7, 8, 9],
          f: false,
          g: true,
          h: null,
          i: '',
        },
      },
    };
    const result = deepMergeJson(target, source);
    expect(result).toMatchInlineSnapshot(`
      {
        "a": 3,
        "b": {
          "c": 4,
          "d": {
            "e": [
              4,
              5,
              6,
              7,
              8,
              9,
            ],
            "f": false,
            "g": true,
            "h": null,
            "i": "",
          },
        },
      }
    `);
  });
});
