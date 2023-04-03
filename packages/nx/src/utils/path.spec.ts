import { getImportPath, joinPathFragments, normalizePath } from './path';

describe('normalizePath', () => {
  it('should remove drive letters', () => {
    expect(normalizePath('C:\\some\\path')).toEqual('/some/path');
  });

  it('should use unix style path separators', () => {
    expect(normalizePath('some\\path')).toEqual('some/path');
  });

  it('should work for existing unix paths', () => {
    expect('/some/unix/path').toEqual('/some/unix/path');
  });
});

describe('joinPathFragments', () => {
  it('should join relative paths', () => {
    expect(joinPathFragments('C://some/path', '../other-path')).toEqual(
      '/some/other-path'
    );
  });
});

describe('getImportPath', () => {
  it('should use the npmScope if it is set to anything other than @', () => {
    expect(getImportPath('myorg', 'my-package')).toEqual('@myorg/my-package');
  });

  it('should allow for a single @ to be used as the npmScope', () => {
    expect(getImportPath('@', 'my-package')).toEqual('@/my-package');
  });

  it('should just use the package name if npmScope is empty', () => {
    expect(getImportPath('', 'my-package')).toEqual('my-package');
  });
});
