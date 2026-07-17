import { updateJson } from 'nx/src/devkit-exports';
import { createTreeWithEmptyWorkspace } from '../../testing';
import {
  assertSupportedInstalledPackageVersion,
  assertSupportedPackageVersion,
  throwForUnsupportedVersion,
} from './version-floor';
import * as installedVersion from './installed-version';

describe('throwForUnsupportedVersion', () => {
  it('throws an error naming the package, installed version, and floor', () => {
    expect(() =>
      throwForUnsupportedVersion('@angular/core', '18.2.0', '19.0.0')
    ).toThrowErrorMatchingInlineSnapshot(`
      "Unsupported version of \`@angular/core\` detected.

        Installed: 18.2.0
        Supported: >= 19.0.0

      Update \`@angular/core\` to 19.0.0 or higher."
    `);
  });
});

describe('assertSupportedPackageVersion', () => {
  it('throws when the declared range is below the supported floor', () => {
    const tree = createTreeWithEmptyWorkspace();
    updateJson(tree, 'package.json', (json) => ({
      ...json,
      dependencies: { 'some-pkg': '~1.5.0' },
    }));

    expect(() =>
      assertSupportedPackageVersion(tree, 'some-pkg', '2.0.0')
    ).toThrow(/Unsupported version of `some-pkg` detected/);
  });

  it('preserves the declared range in the thrown message (not the cleaned form)', () => {
    const tree = createTreeWithEmptyWorkspace();
    updateJson(tree, 'package.json', (json) => ({
      ...json,
      dependencies: { 'some-pkg': '~1.5.0' },
    }));

    expect(() =>
      assertSupportedPackageVersion(tree, 'some-pkg', '2.0.0')
    ).toThrow(/Installed: ~1\.5\.0/);
  });

  it('does not throw when the package is not declared (fresh-install path)', () => {
    const tree = createTreeWithEmptyWorkspace();
    expect(() =>
      assertSupportedPackageVersion(tree, 'some-pkg', '2.0.0')
    ).not.toThrow();
  });

  it('does not throw when declared as `latest`', () => {
    const tree = createTreeWithEmptyWorkspace();
    updateJson(tree, 'package.json', (json) => ({
      ...json,
      dependencies: { 'some-pkg': 'latest' },
    }));

    expect(() =>
      assertSupportedPackageVersion(tree, 'some-pkg', '2.0.0')
    ).not.toThrow();
  });

  it('does not throw when declared as `next`', () => {
    const tree = createTreeWithEmptyWorkspace();
    updateJson(tree, 'package.json', (json) => ({
      ...json,
      dependencies: { 'some-pkg': 'next' },
    }));

    expect(() =>
      assertSupportedPackageVersion(tree, 'some-pkg', '2.0.0')
    ).not.toThrow();
  });

  it('does not throw when declared at or above the supported floor', () => {
    const tree = createTreeWithEmptyWorkspace();
    updateJson(tree, 'package.json', (json) => ({
      ...json,
      dependencies: { 'some-pkg': '^2.5.0' },
    }));

    expect(() =>
      assertSupportedPackageVersion(tree, 'some-pkg', '2.0.0')
    ).not.toThrow();
  });
});

describe('assertSupportedInstalledPackageVersion', () => {
  let getInstalledPackageVersionSpy: jest.SpyInstance;

  beforeEach(() => {
    getInstalledPackageVersionSpy = jest.spyOn(
      installedVersion,
      'getInstalledPackageVersion'
    );
  });

  afterEach(() => {
    getInstalledPackageVersionSpy.mockRestore();
  });

  it('throws when the installed version is below the supported floor', () => {
    getInstalledPackageVersionSpy.mockReturnValue('1.5.0');

    expect(() =>
      assertSupportedInstalledPackageVersion('some-pkg', '2.0.0')
    ).toThrow(/Unsupported version of `some-pkg` detected/);
  });

  it('reports the installed version in the thrown message', () => {
    getInstalledPackageVersionSpy.mockReturnValue('1.5.0');

    expect(() =>
      assertSupportedInstalledPackageVersion('some-pkg', '2.0.0')
    ).toThrow(/Installed: 1\.5\.0/);
  });

  it('does not throw when the package is not resolvable (fresh-install path)', () => {
    getInstalledPackageVersionSpy.mockReturnValue(null);

    expect(() =>
      assertSupportedInstalledPackageVersion('some-pkg', '2.0.0')
    ).not.toThrow();
  });

  it('does not throw when the installed version is at the supported floor', () => {
    getInstalledPackageVersionSpy.mockReturnValue('2.0.0');

    expect(() =>
      assertSupportedInstalledPackageVersion('some-pkg', '2.0.0')
    ).not.toThrow();
  });

  it('does not throw when the installed version is above the supported floor', () => {
    getInstalledPackageVersionSpy.mockReturnValue('2.5.3');

    expect(() =>
      assertSupportedInstalledPackageVersion('some-pkg', '2.0.0')
    ).not.toThrow();
  });

  it('does not throw on a prerelease of the supported major (treats `2.0.0-rc.1` as `2.0.0`)', () => {
    getInstalledPackageVersionSpy.mockReturnValue('2.0.0-rc.1');

    expect(() =>
      assertSupportedInstalledPackageVersion('some-pkg', '2.0.0')
    ).not.toThrow();
  });

  it('throws on a prerelease that is genuinely below the supported floor', () => {
    getInstalledPackageVersionSpy.mockReturnValue('1.9.0-rc.1');

    expect(() =>
      assertSupportedInstalledPackageVersion('some-pkg', '2.0.0')
    ).toThrow(/Unsupported version of `some-pkg` detected/);
  });
});
