// mock stuff that relies or make changes to the filesystem
jest.mock('child_process');
jest.mock('@nx/devkit', () => ({
  ...jest.requireActual('@nx/devkit'),
  getPackageManagerCommand: jest.fn(() => ({ install: '' })),
  writeJsonFile: jest.fn(),
}));

import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { readJson, updateJson } from '@nx/devkit';
import installRequiredPackages from './install-required-packages';

describe('installed-required-packages', () => {
  it('should install the dependencies if they do not exist for v15', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace();
    updateJson(tree, 'package.json', (pkg) => ({
      ...pkg,
      dependencies: {
        '@angular/core': '~15.0.0',
      },
      devDependencies: {
        '@angular-devkit/build-angular': '~15.0.0',
      },
    }));

    // ACT
    await installRequiredPackages(tree);

    // ASSERT
    const pkgJson = readJson(tree, 'package.json');
    expect(pkgJson.dependencies).toMatchInlineSnapshot(`
      {
        "@angular/core": "~15.0.0",
      }
    `);
    expect(pkgJson.devDependencies).toMatchInlineSnapshot(`
      {
        "@angular-devkit/build-angular": "~15.0.0",
        "@angular-devkit/core": "~15.0.0",
        "@angular-devkit/schematics": "~15.0.0",
        "@schematics/angular": "~15.0.0",
      }
    `);
  });

  it('should install the dependencies if they do not exist for v14', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace();
    updateJson(tree, 'package.json', (pkg) => ({
      ...pkg,
      dependencies: {
        '@angular/core': '~14.0.0',
      },
      devDependencies: {
        '@angular-devkit/build-angular': '~14.0.0',
      },
    }));

    // ACT
    await installRequiredPackages(tree);

    // ASSERT
    const pkgJson = readJson(tree, 'package.json');
    expect(pkgJson.dependencies).toMatchInlineSnapshot(`
      {
        "@angular/core": "~14.0.0",
      }
    `);
    expect(pkgJson.devDependencies).toMatchInlineSnapshot(`
      {
        "@angular-devkit/build-angular": "~14.0.0",
        "@angular-devkit/core": "~14.0.0",
        "@angular-devkit/schematics": "~14.0.0",
        "@schematics/angular": "~14.0.0",
      }
    `);
  });

  it('should not install the dependencies if they exist for v15', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace();
    updateJson(tree, 'package.json', (pkg) => ({
      ...pkg,
      dependencies: {
        '@angular/core': '~15.0.0',
      },
      devDependencies: {
        '@angular-devkit/build-angular': '~15.0.0',
        '@angular-devkit/core': '~15.0.0',
        '@angular-devkit/schematics': '~15.0.0',
        '@schematics/angular': '~15.0.0',
      },
    }));

    // ACT
    await installRequiredPackages(tree);

    // ASSERT
    const pkgJson = readJson(tree, 'package.json');
    expect(pkgJson.dependencies).toMatchInlineSnapshot(`
      {
        "@angular/core": "~15.0.0",
      }
    `);
    expect(pkgJson.devDependencies).toMatchInlineSnapshot(`
      {
        "@angular-devkit/build-angular": "~15.0.0",
        "@angular-devkit/core": "~15.0.0",
        "@angular-devkit/schematics": "~15.0.0",
        "@schematics/angular": "~15.0.0",
      }
    `);
  });

  it('should not install the dependencies if they exist for v14', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace();
    updateJson(tree, 'package.json', (pkg) => ({
      ...pkg,
      dependencies: {
        '@angular/core': '~14.0.0',
      },
      devDependencies: {
        '@angular-devkit/build-angular': '~14.0.0',
        '@angular-devkit/core': '~14.0.0',
        '@angular-devkit/schematics': '~14.0.0',
        '@schematics/angular': '~14.0.0',
      },
    }));

    // ACT
    await installRequiredPackages(tree);

    // ASSERT
    const pkgJson = readJson(tree, 'package.json');
    expect(pkgJson.dependencies).toMatchInlineSnapshot(`
      {
        "@angular/core": "~14.0.0",
      }
    `);
    expect(pkgJson.devDependencies).toMatchInlineSnapshot(`
      {
        "@angular-devkit/build-angular": "~14.0.0",
        "@angular-devkit/core": "~14.0.0",
        "@angular-devkit/schematics": "~14.0.0",
        "@schematics/angular": "~14.0.0",
      }
    `);
  });

  it('should install the missing dependencies for v15', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace();
    updateJson(tree, 'package.json', (pkg) => ({
      ...pkg,
      dependencies: {
        '@angular/core': '~15.0.0',
      },
      devDependencies: {
        '@angular-devkit/build-angular': '~15.0.0',
        '@angular-devkit/core': '~15.0.0',
        '@schematics/angular': '~15.0.0',
      },
    }));

    // ACT
    await installRequiredPackages(tree);

    // ASSERT
    const pkgJson = readJson(tree, 'package.json');
    expect(pkgJson.dependencies).toMatchInlineSnapshot(`
      {
        "@angular/core": "~15.0.0",
      }
    `);
    expect(pkgJson.devDependencies).toMatchInlineSnapshot(`
      {
        "@angular-devkit/build-angular": "~15.0.0",
        "@angular-devkit/core": "~15.0.0",
        "@angular-devkit/schematics": "~15.0.0",
        "@schematics/angular": "~15.0.0",
      }
    `);
  });

  it('should not install the missing dependencies for v14', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace();
    updateJson(tree, 'package.json', (pkg) => ({
      ...pkg,
      dependencies: {
        '@angular/core': '~14.0.0',
      },
      devDependencies: {
        '@angular-devkit/build-angular': '~14.0.0',
        '@angular-devkit/core': '~14.0.0',
        '@schematics/angular': '~14.0.0',
      },
    }));

    // ACT
    await installRequiredPackages(tree);

    // ASSERT
    const pkgJson = readJson(tree, 'package.json');
    expect(pkgJson.dependencies).toMatchInlineSnapshot(`
      {
        "@angular/core": "~14.0.0",
      }
    `);
    expect(pkgJson.devDependencies).toMatchInlineSnapshot(`
      {
        "@angular-devkit/build-angular": "~14.0.0",
        "@angular-devkit/core": "~14.0.0",
        "@angular-devkit/schematics": "~14.0.0",
        "@schematics/angular": "~14.0.0",
      }
    `);
  });
});
