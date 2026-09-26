import { getFormatterSetup } from './formatter-setup';
import { oxfmtVersion, prettierVersion } from './versions';

describe('getFormatterSetup', () => {
  it.each([
    ['prettier', prettierVersion],
    ['oxfmt', oxfmtVersion],
  ])('returns the %s setup with its own version', (formatter, version) => {
    expect(getFormatterSetup(formatter)).toEqual(
      expect.objectContaining({ version })
    );
  });

  it.each(['none', undefined, 'biome'])(
    'returns undefined for %s',
    (formatter) => {
      expect(getFormatterSetup(formatter)).toBeUndefined();
    }
  );

  // A lookup written with `in` answers true for inherited members and hands
  // back an Object.prototype function, which `setUpFormatter` would then call.
  it.each(['constructor', 'toString', '__proto__', 'hasOwnProperty'])(
    'does not resolve the inherited member %s',
    (member) => {
      expect(getFormatterSetup(member)).toBeUndefined();
    }
  );
});
