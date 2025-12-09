import { readJson, readNxJson, Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import reactInitGenerator from './init';

describe('init', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should add react dependencies', async () => {
    await reactInitGenerator(tree, { skipFormat: true });
    const packageJson = readJson(tree, 'package.json');
    expect(packageJson.dependencies['react']).toBeDefined();
    expect(packageJson.dependencies['react-dom']).toBeDefined();
    expect(packageJson.devDependencies['@nx/react']).toBeDefined();
  });

  it('should NOT add react-router plugin when useReactRouterPlugin is false', async () => {
    await reactInitGenerator(tree, {
      skipFormat: true,
      addPlugin: true,
      useReactRouterPlugin: false,
    });
    const nxJson = readNxJson(tree);
    const hasRouterPlugin = nxJson.plugins?.some(
      (p) =>
        (typeof p === 'string' && p === '@nx/react/router-plugin') ||
        (typeof p === 'object' && p.plugin === '@nx/react/router-plugin')
    );
    expect(hasRouterPlugin).toBeFalsy();
  });

  it('should add react-router plugin when useReactRouterPlugin is true', async () => {
    await reactInitGenerator(tree, {
      skipFormat: true,
      addPlugin: true,
      useReactRouterPlugin: true,
    });
    const nxJson = readNxJson(tree);
    const hasRouterPlugin = nxJson.plugins?.some(
      (p) =>
        (typeof p === 'string' && p === '@nx/react/router-plugin') ||
        (typeof p === 'object' && p.plugin === '@nx/react/router-plugin')
    );
    expect(hasRouterPlugin).toBeTruthy();
  });

  it('should NOT add react-router plugin when addPlugin is false even if useReactRouterPlugin is true', async () => {
    await reactInitGenerator(tree, {
      skipFormat: true,
      addPlugin: false,
      useReactRouterPlugin: true,
    });
    const nxJson = readNxJson(tree);
    const hasRouterPlugin = nxJson.plugins?.some(
      (p) =>
        (typeof p === 'string' && p === '@nx/react/router-plugin') ||
        (typeof p === 'object' && p.plugin === '@nx/react/router-plugin')
    );
    expect(hasRouterPlugin).toBeFalsy();
  });
});
