import { unparse } from './unparse';

describe('unparse', () => {
  it('should unparse primitive, boolean and array values', () => {
    expect(
      unparse({
        preset: 'apps',
        interactive: true,
        nxCloud: false,
        name: 'my workspace',
        skip: ['a', 'b'],
        empty: null,
      })
    ).toEqual([
      '--preset=apps',
      '--interactive',
      '--no-nxCloud',
      '--name="my workspace"',
      '--skip=a',
      '--skip=b',
    ]);
  });

  it('should flatten nested objects into dot-delimited flags', () => {
    expect(unparse({ opts: { a: { b: 1 }, c: 'd' } })).toEqual([
      '--opts.a.b=1',
      '--opts.c=d',
    ]);
  });
});
