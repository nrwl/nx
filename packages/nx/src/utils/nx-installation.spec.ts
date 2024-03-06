import { getPackageName } from './nx-installation';

describe('get package name', () => {
  it.each([
    ['plugin', 'plugin'],
    ['plugin/other', 'plugin'],
    ['@scope/plugin', '@scope/plugin'],
    ['@scope/plugin/other', '@scope/plugin'],
  ])('should read package name for %s: %s', (input, expected) => {
    expect(getPackageName(input)).toEqual(expected);
  });
});
