import { readJson, updateJson, type Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { angularDevkitVersion, angularVersion } from '../../utils/versions';
import { ensureAngularDependencies } from './ensure-angular-dependencies';

describe('ensureAngularDependencies', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should add angular dependencies', () => {
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

    // codelyzer should no longer be there by default
    expect(devDependencies['codelyzer']).toBeUndefined();
  });

  it('should add angular dependencies respecting base packages versions', () => {
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
    const { dependencies, devDependencies } = readJson(tree, 'package.json');

    expect(dependencies['@angular/animations']).toBe('~15.0.0');
    expect(dependencies['@angular/common']).toBe('~15.0.0');
    expect(dependencies['@angular/compiler']).toBe('~15.0.0');
    expect(dependencies['@angular/core']).toBe('~15.0.0');
    expect(dependencies['@angular/platform-browser']).toBe('~15.0.0');
    expect(dependencies['@angular/platform-browser-dynamic']).toBe('~15.0.0');
    expect(dependencies['@angular/router']).toBe('~15.0.0');
    expect(dependencies['rxjs']).toBeDefined();
    expect(dependencies['tslib']).toBeDefined();
    expect(dependencies['zone.js']).toBeDefined();
    expect(devDependencies['@angular/cli']).toBe('~15.0.0');
    expect(devDependencies['@angular/compiler-cli']).toBe('~15.0.0');
    expect(devDependencies['@angular/language-service']).toBe('~15.0.0');
    expect(devDependencies['@angular-devkit/build-angular']).toBe('~15.0.0');
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
    }));

    // ACT
    ensureAngularDependencies(tree);

    // ASSERT
    const { dependencies } = readJson(tree, 'package.json');

    expect(dependencies['@angular/animations']).toBe('~15.0.1');
    expect(dependencies['@angular/core']).toBe('~15.0.0');
  });
});
