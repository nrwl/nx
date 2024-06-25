import { getPackageNameFromImportPath } from './get-package-name-from-import-path';

describe('getPackageNameFromImportPath', () => {
  it.each([
    ['@nx/workspace', '@nx/workspace'],
    ['@nx/workspace/plugin', '@nx/workspace'],
    ['@nx/workspace/other', '@nx/workspace'],
    ['nx/plugin', 'nx'],
    ['nx', 'nx'],
  ])('should return %s for %s', (input, expected) => {
    expect(getPackageNameFromImportPath(input)).toEqual(expected);
  });
});
