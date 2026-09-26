import { assertPackageIsInstalled } from './assert-package';

describe('assertPackageIsInstalled', () => {
  it('should not throw when the package is resolvable', () => {
    expect(() =>
      assertPackageIsInstalled('path', '@nx/react:module-federation-dev-server')
    ).not.toThrow();
  });

  it('should throw naming the package and the requiring executor when not installed', () => {
    expect(() =>
      assertPackageIsInstalled(
        '@nx/not-a-real-package',
        '@nx/react:module-federation-dev-server'
      )
    ).toThrow(
      'The "@nx/not-a-real-package" package is required by "@nx/react:module-federation-dev-server" but is not installed. Please install it and try again.'
    );
  });
});
