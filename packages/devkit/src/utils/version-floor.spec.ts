import { updateJson } from 'nx/src/devkit-exports';
import { createTreeWithEmptyWorkspace } from '../../testing';
import {
  assertSupportedPackageVersion,
  throwForUnsupportedVersion,
} from './version-floor';

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
