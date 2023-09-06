import { addDependenciesToPackageJson, readJson, Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';

import { nxVersion } from '../../utils/versions';

import webInitGenerator from './init';
jest.mock('@nx/devkit', () => {
  return {
    ...jest.requireActual('@nx/devkit'),
    ensurePackage: jest.fn((pkg) => jest.requireActual(pkg)),
  };
});

describe('init', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should add web dependencies', async () => {
    const existing = 'existing';
    const existingVersion = '1.0.0';
    addDependenciesToPackageJson(
      tree,
      {
        '@nx/web': nxVersion,
        [existing]: existingVersion,
      },
      {
        [existing]: existingVersion,
      }
    );
    await webInitGenerator(tree, {});
    const packageJson = readJson(tree, 'package.json');
    expect(packageJson.devDependencies['@nx/web']).toBeDefined();
    expect(packageJson.devDependencies[existing]).toBeDefined();
    expect(packageJson.dependencies['@nx/web']).toBeUndefined();
    expect(packageJson.dependencies[existing]).toBeDefined();
  });

  it('should not add jest config if unitTestRunner is none', async () => {
    await webInitGenerator(tree, {
      unitTestRunner: 'none',
    });
    expect(tree.exists('jest.config.js')).toBe(false);
  });

  it('should init playwright', async () => {
    await webInitGenerator(tree, {
      e2eTestRunner: 'playwright',
    });
    expect(readJson(tree, 'package.json').devDependencies).toEqual(
      expect.objectContaining({
        '@nx/playwright': expect.any(String),
        '@playwright/test': expect.any(String),
      })
    );
  });

  it('should init cypress', async () => {
    await webInitGenerator(tree, {
      e2eTestRunner: 'cypress',
    });
    expect(readJson(tree, 'package.json').devDependencies).toEqual(
      expect.objectContaining({
        '@nx/cypress': expect.any(String),
        cypress: expect.any(String),
      })
    );
  });
});
