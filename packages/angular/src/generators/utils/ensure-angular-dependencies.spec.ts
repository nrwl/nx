import { readJson, updateJson, type Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import * as devkit from '@nx/devkit';
import { parse } from 'yaml';
import { angularDevkitVersion, angularVersion } from '../../utils/versions';
import { ensureAngularDependencies } from './ensure-angular-dependencies';

describe('ensureAngularDependencies', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  describe('pnpm build scripts', () => {
    afterEach(() => jest.restoreAllMocks());

    it('should record decisions before installation and preserve user choices', () => {
      jest.spyOn(devkit, 'detectPackageManager').mockReturnValue('pnpm');
      updateJson(tree, 'package.json', (json) => ({
        ...json,
        packageManager: 'pnpm@11.21.0',
      }));
      tree.write(
        'pnpm-workspace.yaml',
        'allowBuilds:\n  nx: true\n  esbuild: true\n  lmdb: false\n  "@parcel/watcher": set this to true or false\n'
      );

      ensureAngularDependencies(tree, true);

      expect(
        parse(tree.read('pnpm-workspace.yaml', 'utf-8')).allowBuilds
      ).toEqual({
        nx: true,
        '@parcel/watcher': false,
        esbuild: true,
        lmdb: false,
        'msgpackr-extract': false,
        less: false,
      });
    });

    it.each(['pnpm@10.6.0', 'npm@10.9.8'])(
      'should not change build settings for %s',
      (packageManager) => {
        jest
          .spyOn(devkit, 'detectPackageManager')
          .mockReturnValue(packageManager.startsWith('pnpm') ? 'pnpm' : 'npm');
        updateJson(tree, 'package.json', (json) => ({
          ...json,
          packageManager,
        }));

        ensureAngularDependencies(tree, true);

        expect(tree.exists('pnpm-workspace.yaml')).toBe(false);
      }
    );
  });

  it('should add angular dependencies when not installed', () => {
    // ACT
    ensureAngularDependencies(tree, true);

    // ASSERT
    const { dependencies, devDependencies } = readJson(tree, 'package.json');

    expect(dependencies['@angular/common']).toBe(angularVersion);
    expect(dependencies['@angular/compiler']).toBe(angularVersion);
    expect(dependencies['@angular/core']).toBe(angularVersion);
    expect(dependencies['@angular/platform-browser']).toBe(angularVersion);
    expect(dependencies['@angular/router']).toBe(angularVersion);
    expect(dependencies['rxjs']).toBeDefined();
    expect(dependencies['tslib']).toBeDefined();
    expect(devDependencies['@angular/cli']).toBe(angularDevkitVersion);
    expect(devDependencies['@angular/compiler-cli']).toBe(angularVersion);
    expect(devDependencies['@angular/language-service']).toBe(angularVersion);
    expect(devDependencies['@angular-devkit/schematics']).toBe(
      angularDevkitVersion
    );
    expect(devDependencies['@schematics/angular']).toBe(angularDevkitVersion);
    expect(dependencies['zone.js']).toBeUndefined();
  });

  it('should add zone.js when zoneless is false', () => {
    ensureAngularDependencies(tree, false);

    const { dependencies } = readJson(tree, 'package.json');
    expect(dependencies['zone.js']).toBeDefined();
  });

  it('should add peer dependencies respecting the @angular/devkit installed version', () => {
    // ARRANGE
    updateJson(tree, 'package.json', (json) => ({
      ...json,
      dependencies: {
        ...json.dependencies,
        '@angular/core': '~20.0.0',
      },
      devDependencies: {
        ...json.devDependencies,
        '@angular-devkit/build-angular': '~20.0.0',
      },
    }));

    // ACT
    ensureAngularDependencies(tree, true);

    // ASSERT
    const { devDependencies } = readJson(tree, 'package.json');
    expect(devDependencies['@angular-devkit/build-angular']).toBe('~20.0.0');
    expect(devDependencies['@angular-devkit/schematics']).toBe('~20.0.0');
    expect(devDependencies['@schematics/angular']).toBe('~20.0.0');
  });

  it('should not overwrite already installed dependencies', () => {
    // ARRANGE
    updateJson(tree, 'package.json', (json) => ({
      ...json,
      dependencies: {
        ...json.dependencies,
        '@angular/animations': '~20.0.1',
        '@angular/core': '~20.0.0',
      },
      devDependencies: {
        ...json.devDependencies,
        '@angular-devkit/build-angular': '~20.0.1',
      },
    }));

    // ACT
    ensureAngularDependencies(tree, true);

    // ASSERT
    const { dependencies, devDependencies } = readJson(tree, 'package.json');

    expect(dependencies['@angular/animations']).toBe('~20.0.1');
    expect(dependencies['@angular/core']).toBe('~20.0.0');
    expect(devDependencies['@angular-devkit/build-angular']).toBe('~20.0.1');
  });

  it('should not add extra runtime dependencies when `@angular/core` is already installed', () => {
    // ARRANGE
    updateJson(tree, 'package.json', (json) => ({
      ...json,
      dependencies: {
        ...json.dependencies,
        '@angular/core': '~20.0.0',
      },
    }));

    // ACT
    ensureAngularDependencies(tree, true);

    // ASSERT
    const { dependencies } = readJson(tree, 'package.json');

    expect(dependencies['@angular/core']).toBe('~20.0.0');
    expect(dependencies['@angular/common']).toBeUndefined();
    expect(dependencies['@angular/compiler']).toBeUndefined();
    expect(dependencies['@angular/platform-browser']).toBeUndefined();
    expect(dependencies['@angular/platform-browser-dynamic']).toBeUndefined();
    expect(dependencies['@angular/router']).toBeUndefined();
    expect(dependencies['rxjs']).toBeUndefined();
    expect(dependencies['tslib']).toBeUndefined();
    expect(dependencies['zone.js']).toBeUndefined();
  });
});
