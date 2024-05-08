import { readJson, updateJson, type Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { angularDevkitVersion, angularVersion } from '../../utils/versions';
import { ensureAngularDependencies } from './ensure-angular-dependencies';

describe('ensureAngularDependencies', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should add angular dependencies when not installed', () => {
    // ACT
    ensureAngularDependencies(tree);

    // ASSERT
    const { dependencies, devDependencies } = readJson(tree, 'package.json');

    expect(dependencies['@angular/animations']).toBe(angularVersion);
    expect(dependencies['@angular/common']).toBe(angularVersion);
    expect(dependencies['@angular/compiler']).toBe(angularVersion);
    expect(dependencies['@angular/core']).toBe(angularVersion);
    expect(dependencies['@angular/platform-browser']).toBe(angularVersion);
    expect(dependencies['@angular/platform-browser-dynamic']).toBe(
      angularVersion
    );
    expect(dependencies['@angular/router']).toBe(angularVersion);
    expect(dependencies['rxjs']).toBeDefined();
    expect(dependencies['tslib']).toBeDefined();
    expect(dependencies['zone.js']).toBeDefined();
    expect(devDependencies['@angular/cli']).toBe(angularDevkitVersion);
    expect(devDependencies['@angular/compiler-cli']).toBe(angularVersion);
    expect(devDependencies['@angular/language-service']).toBe(angularVersion);
    expect(devDependencies['@angular-devkit/build-angular']).toBe(
      angularDevkitVersion
    );
    expect(devDependencies['@angular-devkit/schematics']).toBe(
      angularDevkitVersion
    );
    expect(devDependencies['@schematics/angular']).toBe(angularDevkitVersion);
  });

  it('should add peer dependencies respecting the @angular/devkit installed version', () => {
    // ARRANGE
    updateJson(tree, 'package.json', (json) => ({
      ...json,
      dependencies: {
        ...json.dependencies,
        '@angular/core': '~15.0.0',
      },
      devDependencies: {
        ...json.devDependencies,
        '@angular-devkit/build-angular': '~15.0.0',
      },
    }));

    // ACT
    ensureAngularDependencies(tree);

    // ASSERT
    const { devDependencies } = readJson(tree, 'package.json');
    expect(devDependencies['@angular-devkit/build-angular']).toBe('~15.0.0');
    expect(devDependencies['@angular-devkit/schematics']).toBe('~15.0.0');
    expect(devDependencies['@schematics/angular']).toBe('~15.0.0');
  });

  it('should not overwrite already installed dependencies', () => {
    // ARRANGE
    updateJson(tree, 'package.json', (json) => ({
      ...json,
      dependencies: {
        ...json.dependencies,
        '@angular/animations': '~15.0.1',
        '@angular/core': '~15.0.0',
      },
      devDependencies: {
        ...json.devDependencies,
        '@angular-devkit/build-angular': '~15.0.1',
      },
    }));

    // ACT
    ensureAngularDependencies(tree);

    // ASSERT
    const { dependencies, devDependencies } = readJson(tree, 'package.json');

    expect(dependencies['@angular/animations']).toBe('~15.0.1');
    expect(dependencies['@angular/core']).toBe('~15.0.0');
    expect(devDependencies['@angular-devkit/build-angular']).toBe('~15.0.1');
  });

  it('should not add extra runtime dependencies when `@angular/core` is already installed', () => {
    // ARRANGE
    updateJson(tree, 'package.json', (json) => ({
      ...json,
      dependencies: {
        ...json.dependencies,
        '@angular/core': '~15.0.0',
      },
    }));

    // ACT
    ensureAngularDependencies(tree);

    // ASSERT
    const { dependencies, devDependencies } = readJson(tree, 'package.json');

    expect(dependencies['@angular/core']).toBe('~15.0.0');
    expect(dependencies['@angular/animations']).toBeUndefined();
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
