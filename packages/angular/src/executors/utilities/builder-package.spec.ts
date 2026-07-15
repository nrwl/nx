import { assertPackageIsInstalled } from './builder-package';

describe('assertPackageIsInstalled', () => {
  it('should not throw when the package is resolvable', () => {
    expect(() =>
      assertPackageIsInstalled('path', '@nx/angular:webpack-browser')
    ).not.toThrow();
  });

  it('should throw naming the package and the requiring executor when not installed', () => {
    expect(() =>
      assertPackageIsInstalled(
        '@nx/not-a-real-package',
        '@nx/angular:webpack-browser'
      )
    ).toThrow(
      'The "@nx/not-a-real-package" package is required by "@nx/angular:webpack-browser" but is not installed. Please install it and try again.'
    );
  });
});
