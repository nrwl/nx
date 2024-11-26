import { resolveVersionSpec } from './resolve-version-spec';

describe('resolveVersionSpec()', () => {
  it('should work for specific name and spec', () => {
    expect(
      resolveVersionSpec(
        'projectA',
        '1.0.4',
        '^1.0.0',
        '/test/packages/packageB'
      )
    ).toEqual('^1.0.0');
  });

  it('should work for a workspace spec', () => {
    expect(
      resolveVersionSpec(
        'projectA',
        '1.0.4',
        'workspace:^1.0.0',
        '/test/packages/packageB'
      )
    ).toEqual('^1.0.0');
  });

  describe('with a workspace alias', () => {
    it('should work for a * workspace alias', () => {
      expect(
        resolveVersionSpec(
          'projectA',
          '1.0.4',
          'workspace:*',
          '/test/packages/packageB'
        )
      ).toEqual('1.0.4');
    });

    it('should work for a ^ workspace alias', () => {
      expect(
        resolveVersionSpec(
          'projectA',
          '1.0.4',
          'workspace:^',
          '/test/packages/packageB'
        )
      ).toEqual('^1.0.4');
    });

    it('should work for a ~ workspace alias', () => {
      expect(
        resolveVersionSpec(
          'projectA',
          '1.0.4',
          'workspace:~',
          '/test/packages/packageB'
        )
      ).toEqual('~1.0.4');
    });
  });

  it('should for a file reference', async () => {
    expect(
      resolveVersionSpec(
        'projectA',
        '1.0.0',
        'file:../projectB',
        '/packages/projectB'
      )
    ).toEqual(expect.stringContaining('/packages/projectB'));
  });

  it('should work for a yarn classic style link reference', async () => {
    expect(
      resolveVersionSpec(
        'projectA',
        '1.0.0',
        'link:../projectB',
        '/packages/projectB'
      )
    ).toEqual(expect.stringContaining('/packages/projectB'));
  });
});
