import { normalizeNxJson } from './normalize-nx-json';

describe('normalizeNxJson', () => {
  it('should expand projects array', () => {
    const result = normalizeNxJson(
      {
        npmScope: 'nrwl',
        implicitDependencies: {
          'package.json': '*',
          'whatever.json': {
            a: {
              b: {
                c: ['demo'],
                d: {
                  e: '*',
                },
              },
            },
          },
        },
      },
      ['demo', 'ui', 'util']
    );

    expect(result.implicitDependencies).toEqual({
      'package.json': ['demo', 'ui', 'util'],
      'whatever.json': {
        a: {
          b: {
            c: ['demo'],
            d: {
              e: ['demo', 'ui', 'util'],
            },
          },
        },
      },
    });
  });
});
