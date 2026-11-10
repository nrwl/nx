import { updateJson, writeJson, type Tree } from '@nx/devkit';
import { TempFs } from '@nx/devkit/internal-testing-utils';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import {
  getInstalledAngularMajorVersion,
  getInstalledAngularVersion,
  supportsSsrAllowedHosts,
  withSsrAllowedHostsSupport,
} from './version-utils';

describe('angularVersionUtils', () => {
  test.each(['15.0.0', '~15.1.0', '^15.2.0', '~15.3.0-beta.0'])(
    'should return correct major version',
    (ngVersion) => {
      // ARRANGE
      const tree = createTreeWithEmptyWorkspace();
      updateJson(tree, 'package.json', (json) => ({
        ...json,
        dependencies: {
          '@angular/core': ngVersion,
        },
      }));

      // ACT
      const angularVersion = getInstalledAngularMajorVersion(tree);

      // ASSERT
      expect(angularVersion).toBe(15);
    }
  );

  test.each([
    ['15.0.0', '15.0.0'],
    ['~15.1.0', '15.1.0'],
    ['^15.2.0', '15.2.0'],
    ['~15.3.0-beta.0', '15.3.0'],
  ])('should return correct major version', (ngVersion, expectedVersion) => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace();
    updateJson(tree, 'package.json', (json) => ({
      ...json,
      dependencies: {
        '@angular/core': ngVersion,
      },
    }));

    // ACT
    const angularVersion = getInstalledAngularVersion(tree);

    // ASSERT
    expect(angularVersion).toEqual(expectedVersion);
  });

  describe('with catalog references', () => {
    let tempFs: TempFs;
    let tree: Tree;

    beforeEach(() => {
      tempFs = new TempFs('angular-version-test');
      tree = createTreeWithEmptyWorkspace();
      tree.root = tempFs.tempDir;
      // force `detectPackageManager` to return `pnpm`
      tempFs.createFileSync('pnpm-lock.yaml', 'lockfileVersion: 9.0');

      tree.write(
        'pnpm-workspace.yaml',
        `
packages:
  - packages/*

catalog:
  "@angular/core": ~18.0.0
  react: ^18.2.0

catalogs:
  angular17:
    "@angular/core": ~17.3.0
`
      );
    });

    afterEach(() => {
      tempFs.cleanup();
    });

    it('should get installed Angular version from default catalog reference', () => {
      updateJson(tree, 'package.json', (json) => ({
        ...json,
        dependencies: {
          '@angular/core': 'catalog:',
        },
      }));

      expect(getInstalledAngularMajorVersion(tree)).toBe(18);
      expect(getInstalledAngularVersion(tree)).toBe('18.0.0');
    });

    it('should get installed Angular version from named catalog reference', () => {
      updateJson(tree, 'package.json', (json) => ({
        ...json,
        dependencies: {
          '@angular/core': 'catalog:angular17',
        },
      }));

      expect(getInstalledAngularVersion(tree)).toBe('17.3.0');
      expect(getInstalledAngularMajorVersion(tree)).toBe(17);
    });
  });
});

describe('supportsSsrAllowedHosts', () => {
  test.each([
    ['19.2.0', false],
    ['20.3.16', false],
    ['20.3.17', true],
    ['20.3.25', true],
    ['21.0.9', false],
    ['21.1.4', false],
    ['21.1.5', true],
    ['21.2.0', true],
    ['22.0.0', true],
    // the option landed part-way through the 21.2 prerelease train, so no
    // prerelease is taken to have it
    ['21.0.0-rc.6', false],
    ['21.2.0-rc.0', false],
    ['21.2.0-rc.1', false],
    ['22.0.0-next.3', false],
  ])(
    'should return %s for the installed "@angular/ssr" %s',
    (ssrVersion, expected) => {
      const tree = createTreeWithEmptyWorkspace();
      writeJson(tree, 'node_modules/@angular/ssr/package.json', {
        name: '@angular/ssr',
        version: ssrVersion,
      });

      expect(supportsSsrAllowedHosts(tree)).toBe(expected);
    }
  );

  // A range is not always resolved to its highest version, so every version it
  // allows has to accept the configuration
  test.each([
    ['~20.2.0', false],
    ['~20.3.0', false],
    ['~20.3.17', true],
    ['20.3.16', false],
    ['20.3.17', true],
    ['^20.0.0', false],
    ['^20.3.17', true],
    ['~21.0.0', false],
    ['~21.1.0', false],
    ['~21.1.5', true],
    ['~21.2.0', true],
    ['~22.1.0', true],
    // a union is only accepted when every one of its ranges is
    ['^20.0.0 || ^21.0.0', false],
    ['~20.3.17 || ~21.0.0', false],
    ['~20.3.17 || ~21.1.5', true],
    // spans the unsupported 21.0 versions
    ['>=20.3.17', false],
    // no prerelease range is taken to accept the configuration
    ['~22.0.0-rc.0', false],
    ['~21.2.0-rc.0', false],
    ['~21.1.0-rc.0', false],
    ['21.0.0-rc.6', false],
    ['21.0.0-next.0', false],
    ['*', false],
    ['latest', false],
    ['not a range', false],
  ])(
    'should return %s for the declared "@angular/ssr" %s',
    (ssrVersion, expected) => {
      const tree = createTreeWithEmptyWorkspace();
      updateJson(tree, 'package.json', (json) => ({
        ...json,
        dependencies: { '@angular/ssr': ssrVersion },
      }));

      expect(supportsSsrAllowedHosts(tree)).toBe(expected);
    }
  );

  it('should use the installed version rather than the declared range', () => {
    const tree = createTreeWithEmptyWorkspace();
    updateJson(tree, 'package.json', (json) => ({
      ...json,
      dependencies: { '@angular/ssr': '~20.3.0' },
    }));
    writeJson(tree, 'node_modules/@angular/ssr/package.json', {
      name: '@angular/ssr',
      version: '20.3.16',
    });

    expect(supportsSsrAllowedHosts(tree)).toBe(false);
  });

  it('should not take an installed prerelease to accept the configuration', () => {
    const tree = createTreeWithEmptyWorkspace();
    writeJson(tree, 'node_modules/@angular/ssr/package.json', {
      name: '@angular/ssr',
      version: '21.2.0-rc.0',
    });

    expect(supportsSsrAllowedHosts(tree)).toBe(false);
  });

  it('should return false when "@angular/ssr" is not there', () => {
    const tree = createTreeWithEmptyWorkspace();

    expect(supportsSsrAllowedHosts(tree)).toBe(false);
  });
});

describe('withSsrAllowedHostsSupport', () => {
  test.each([
    ['~20.3.0', '~20.3.17'],
    ['^20.0.0', '^20.3.17'],
    ['~21.1.0', '~21.1.5'],
    ['^21.0.0', '^21.1.5'],
    // already accepts an allowed hosts configuration
    ['~20.3.17', '~20.3.17'],
    ['~21.2.0', '~21.2.0'],
    ['~22.1.0', '~22.1.0'],
    // no version in the range accepts one
    ['~19.2.0', '~19.2.0'],
    ['~20.2.0', '~20.2.0'],
    ['~21.0.0', '~21.0.0'],
    ['21.0.0-rc.6', '21.0.0-rc.6'],
    // pinned or not a range we can raise
    ['20.3.0', '20.3.0'],
    ['>=20.0.0', '>=20.0.0'],
    ['~20.3', '~20.3'],
    ['*', '*'],
    ['latest', 'latest'],
    // raising a union would drop the release lines it covers
    ['^20.0.0 || ^21.0.0', '^20.0.0 || ^21.0.0'],
    ['~20.3.17 || ~21.0.0', '~20.3.17 || ~21.0.0'],
  ])('should turn "%s" into "%s"', (range, expected) => {
    expect(withSsrAllowedHostsSupport(range)).toBe(expected);
  });
});
