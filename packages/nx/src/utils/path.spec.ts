import { normalizePath, joinPathFragments } from './path';

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
