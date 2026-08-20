import { updateJson, workspaceRoot } from 'nx/src/devkit-exports';
import { FsTree } from 'nx/src/generators/tree';
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

  it('asks to install dependencies when the declared range straddles the floor and no installed version resolves', () => {
    const tree = createTreeWithEmptyWorkspace();
    updateJson(tree, 'package.json', (json) => ({
      ...json,
      dependencies: { 'some-pkg': '>=1.5.0 <3.0.0' },
    }));

    expect(() =>
      assertSupportedPackageVersion(tree, 'some-pkg', '2.0.0')
    ).toThrow(/Unable to determine the installed version of `some-pkg`/);
  });

  it('does not throw when the exact declared version is a prerelease of the floor', () => {
    const tree = createTreeWithEmptyWorkspace();
    updateJson(tree, 'package.json', (json) => ({
      ...json,
      dependencies: { 'some-pkg': '2.0.0-rc.1' },
    }));

    expect(() =>
      assertSupportedPackageVersion(tree, 'some-pkg', '2.0.0')
    ).not.toThrow();
  });

  it('throws when the exact declared version is a prerelease below the floor', () => {
    const tree = createTreeWithEmptyWorkspace();
    updateJson(tree, 'package.json', (json) => ({
      ...json,
      dependencies: { 'some-pkg': '1.9.0-rc.1' },
    }));

    expect(() =>
      assertSupportedPackageVersion(tree, 'some-pkg', '2.0.0')
    ).toThrow(/Unsupported version of `some-pkg` detected/);
  });

  it('does not throw when the declared range only reaches the floor through its prereleases', () => {
    const tree = createTreeWithEmptyWorkspace();
    updateJson(tree, 'package.json', (json) => ({
      ...json,
      dependencies: { 'some-pkg': '>=2.0.0-rc.1 <2.0.0' },
    }));

    expect(() =>
      assertSupportedPackageVersion(tree, 'some-pkg', '2.0.0')
    ).not.toThrow();
  });

  it('does not throw when the installed version is a prerelease of the floor within a prerelease-only range', () => {
    const tree = createTreeWithEmptyWorkspace();
    updateJson(tree, 'package.json', (json) => ({
      ...json,
      dependencies: { 'some-pkg': '>=2.0.0-rc.1 <2.0.0' },
    }));
    tree.write(
      'node_modules/some-pkg/package.json',
      JSON.stringify({ name: 'some-pkg', version: '2.0.0-rc.2' })
    );

    expect(() =>
      assertSupportedPackageVersion(tree, 'some-pkg', '2.0.0')
    ).not.toThrow();
  });

  it('conservatively asks to install dependencies for a prerelease range below the floor', () => {
    const tree = createTreeWithEmptyWorkspace();
    updateJson(tree, 'package.json', (json) => ({
      ...json,
      dependencies: { 'some-pkg': '>=1.9.0-rc.1 <2.0.0' },
    }));

    expect(() =>
      assertSupportedPackageVersion(tree, 'some-pkg', '2.0.0')
    ).toThrow(/Unable to determine the installed version of `some-pkg`/);
  });

  it('does not throw when the declared range minimum is a prerelease of the floor', () => {
    const tree = createTreeWithEmptyWorkspace();
    updateJson(tree, 'package.json', (json) => ({
      ...json,
      dependencies: { 'some-pkg': '>=2.0.0-rc.1 <3.0.0' },
    }));

    expect(() =>
      assertSupportedPackageVersion(tree, 'some-pkg', '2.0.0')
    ).not.toThrow();
  });

  it('throws when a compound declared range is entirely below the floor', () => {
    const tree = createTreeWithEmptyWorkspace();
    updateJson(tree, 'package.json', (json) => ({
      ...json,
      dependencies: { 'some-pkg': '>=1.0.0 <1.6.0' },
    }));

    expect(() =>
      assertSupportedPackageVersion(tree, 'some-pkg', '2.0.0')
    ).toThrow(/Unsupported version of `some-pkg` detected/);
  });

  it('throws when the installed version satisfies the declared range and is below the floor', () => {
    const tree = createTreeWithEmptyWorkspace();
    updateJson(tree, 'package.json', (json) => ({
      ...json,
      dependencies: { 'some-pkg': '>=1.0.0 <3.0.0' },
    }));
    tree.write(
      'node_modules/some-pkg/package.json',
      JSON.stringify({ name: 'some-pkg', version: '1.5.0' })
    );

    expect(() =>
      assertSupportedPackageVersion(tree, 'some-pkg', '2.0.0')
    ).toThrow(/Installed: 1\.5\.0/);
  });

  it('does not throw when the installed version satisfies the declared range and meets the floor', () => {
    const tree = createTreeWithEmptyWorkspace();
    updateJson(tree, 'package.json', (json) => ({
      ...json,
      dependencies: { 'some-pkg': '>=1.0.0 <3.0.0' },
    }));
    tree.write(
      'node_modules/some-pkg/package.json',
      JSON.stringify({ name: 'some-pkg', version: '2.5.0' })
    );

    expect(() =>
      assertSupportedPackageVersion(tree, 'some-pkg', '2.0.0')
    ).not.toThrow();
  });

  it('ignores an installed version that does not satisfy the declared range (declared intent wins)', () => {
    const tree = createTreeWithEmptyWorkspace();
    updateJson(tree, 'package.json', (json) => ({
      ...json,
      dependencies: { 'some-pkg': '~1.5.0' },
    }));
    tree.write(
      'node_modules/some-pkg/package.json',
      JSON.stringify({ name: 'some-pkg', version: '2.5.0' })
    );

    expect(() =>
      assertSupportedPackageVersion(tree, 'some-pkg', '2.0.0')
    ).toThrow(/Installed: ~1\.5\.0/);
  });

  it('treats an installed prerelease as its release version', () => {
    const tree = createTreeWithEmptyWorkspace();
    updateJson(tree, 'package.json', (json) => ({
      ...json,
      dependencies: { 'some-pkg': '>=1.0.0 <3.0.0' },
    }));
    tree.write(
      'node_modules/some-pkg/package.json',
      JSON.stringify({ name: 'some-pkg', version: '1.5.0-beta.1' })
    );

    expect(() =>
      assertSupportedPackageVersion(tree, 'some-pkg', '2.0.0')
    ).toThrow(/Installed: 1\.5\.0-beta\.1/);
  });

  it('does not throw when an installed prerelease meets the floor within a plain range', () => {
    const tree = createTreeWithEmptyWorkspace();
    updateJson(tree, 'package.json', (json) => ({
      ...json,
      dependencies: { 'some-pkg': '>=1.0.0 <3.0.0' },
    }));
    tree.write(
      'node_modules/some-pkg/package.json',
      JSON.stringify({ name: 'some-pkg', version: '2.5.0-rc.1' })
    );

    expect(() =>
      assertSupportedPackageVersion(tree, 'some-pkg', '2.0.0')
    ).not.toThrow();
  });

  it('ignores an installed package.json with a non-string version', () => {
    const tree = createTreeWithEmptyWorkspace();
    updateJson(tree, 'package.json', (json) => ({
      ...json,
      dependencies: { 'some-pkg': '>=1.0.0 <3.0.0' },
    }));
    tree.write(
      'node_modules/some-pkg/package.json',
      JSON.stringify({ name: 'some-pkg', version: 42 })
    );

    expect(() =>
      assertSupportedPackageVersion(tree, 'some-pkg', '2.0.0')
    ).toThrow(/Unable to determine the installed version of `some-pkg`/);
  });

  it('ignores an installed package.json with an object version', () => {
    const tree = createTreeWithEmptyWorkspace();
    updateJson(tree, 'package.json', (json) => ({
      ...json,
      dependencies: { 'some-pkg': '>=1.0.0 <3.0.0' },
    }));
    tree.write(
      'node_modules/some-pkg/package.json',
      JSON.stringify({ name: 'some-pkg', version: { value: '2.5.0' } })
    );

    expect(() =>
      assertSupportedPackageVersion(tree, 'some-pkg', '2.0.0')
    ).toThrow(/Unable to determine the installed version of `some-pkg`/);
  });

  it('does not throw when an installed floor prerelease matches an upper prerelease bound', () => {
    const tree = createTreeWithEmptyWorkspace();
    updateJson(tree, 'package.json', (json) => ({
      ...json,
      dependencies: { 'some-pkg': '<=2.0.0-rc.1' },
    }));
    tree.write(
      'node_modules/some-pkg/package.json',
      JSON.stringify({ name: 'some-pkg', version: '2.0.0-rc.1' })
    );

    expect(() =>
      assertSupportedPackageVersion(tree, 'some-pkg', '2.0.0')
    ).not.toThrow();
  });

  it('falls back to module resolution when the tree has no node_modules (e.g. Yarn PnP)', () => {
    const spy = jest
      .spyOn(installedVersion, 'getInstalledPackageVersion')
      .mockReturnValue('1.5.0');
    try {
      const tree = new FsTree(workspaceRoot, false);
      updateJson(tree, 'package.json', (json) => ({
        ...json,
        dependencies: { 'some-pkg': '>=1.0.0 <3.0.0' },
      }));

      expect(() =>
        assertSupportedPackageVersion(tree, 'some-pkg', '2.0.0')
      ).toThrow(/Installed: 1\.5\.0/);
    } finally {
      spy.mockRestore();
    }
  });

  it('does not resolve from the process for a tree not rooted at the workspace', () => {
    const spy = jest
      .spyOn(installedVersion, 'getInstalledPackageVersion')
      .mockReturnValue('1.5.0');
    try {
      const tree = createTreeWithEmptyWorkspace();
      updateJson(tree, 'package.json', (json) => ({
        ...json,
        dependencies: { 'some-pkg': '>=1.0.0 <3.0.0' },
      }));

      expect(() =>
        assertSupportedPackageVersion(tree, 'some-pkg', '2.0.0')
      ).toThrow(/Unable to determine the installed version of `some-pkg`/);
      expect(spy).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
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
