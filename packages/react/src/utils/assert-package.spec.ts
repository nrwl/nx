import { assertPackageIsInstalled } from './assert-package';

describe('assertPackageIsInstalled', () => {
  it('should not throw when the package is resolvable', () => {
    expect(() =>
      assertPackageIsInstalled('path', '@nx/next/plugins/component-testing')
    ).not.toThrow();
  });

  it('should throw naming the package and the requiring executor when not installed', () => {
    expect(() =>
      assertPackageIsInstalled(
        '@nx/not-a-real-package',
        '@nx/next/plugins/component-testing'
      )
    ).toThrow(
      'The "@nx/not-a-real-package" package is required by "@nx/next/plugins/component-testing" but is not installed. Please install it and try again.'
    );
  });
});
