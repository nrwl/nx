import {
  isContainedRelativePath,
  joinPathFragments,
  normalizePath,
} from './path';

describe('normalizePath', () => {
  it('should remove drive letters', () => {
    expect(normalizePath('C:\\some\\path')).toEqual('/some/path');
    expect(normalizePath('c:\\some\\path')).toEqual('/some/path');
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

describe('isContainedRelativePath', () => {
  it.each(['migrations.json', './migrations.json', 'a/b/../migrations.json'])(
    'should accept the contained path %s',
    (path) => {
      expect(isContainedRelativePath(path)).toBe(true);
    }
  );

  it.each(['../migrations.json', '..', 'a/../../migrations.json'])(
    'should reject the escaping path %s',
    (path) => {
      expect(isContainedRelativePath(path)).toBe(false);
    }
  );

  it('should reject absolute paths, which path.join would treat as relative', () => {
    expect(isContainedRelativePath('/etc/profile')).toBe(false);
  });

  it.each(['.\\migrations.json', 'a\\b\\..\\migrations.json'])(
    'should accept the contained backslash-separated path %s',
    (path) => {
      expect(isContainedRelativePath(path)).toBe(true);
    }
  );

  it.each([
    '..\\migrations.json',
    'a/..\\..\\migrations.json',
    '\\etc\\profile',
    'C:\\etc\\profile',
    'C:a\\..\\..\\migrations.json',
  ])('should reject the backslash-separated escaping path %s', (path) => {
    expect(isContainedRelativePath(path)).toBe(false);
  });
});
