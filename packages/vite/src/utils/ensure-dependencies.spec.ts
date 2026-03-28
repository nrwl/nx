import { addDependenciesToPackageJson, readJson, type Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { ensureDependencies } from './ensure-dependencies';
import { nxVersion } from './versions';

describe('@nx/vite:init', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
  });

  it('should add vite packages and react-related dependencies for vite', () => {
    const existing = 'existing';
    const existingVersion = '1.0.0';
    addDependenciesToPackageJson(
      tree,
      { '@nx/vite': nxVersion, [existing]: existingVersion },
      { [existing]: existingVersion }
    );
    ensureDependencies(tree, {
      uiFramework: 'react',
    });
    const packageJson = readJson(tree, 'package.json');

    expect(packageJson).toMatchSnapshot();
  });

  it('should add swc plugin for react', () => {
    ensureDependencies(tree, {
      uiFramework: 'react',
      compiler: 'swc',
    });
    const packageJson = readJson(tree, 'package.json');
    expect(packageJson.devDependencies['@vitejs/plugin-react-swc']).toEqual(
      '^4.3.0'
    );
    expect(packageJson.devDependencies['@vitejs/plugin-react']).toBeUndefined();
  });

  it('should add swc plugin for react even with older vite', () => {
    addDependenciesToPackageJson(tree, {}, { vite: '^7.0.0' });
    ensureDependencies(tree, {
      uiFramework: 'react',
      compiler: 'swc',
    });
    const packageJson = readJson(tree, 'package.json');
    expect(packageJson.devDependencies['@vitejs/plugin-react-swc']).toEqual(
      '^4.3.0'
    );
  });

  it('should support --testEnvironment=jsdom', () => {
    ensureDependencies(tree, {
      testEnvironment: 'jsdom',
      uiFramework: 'none',
    });

    const packageJson = readJson(tree, 'package.json');

    expect(packageJson).toMatchSnapshot();
  });

  it('should support --testEnvironment=happy-dom', () => {
    ensureDependencies(tree, {
      testEnvironment: 'happy-dom',
      uiFramework: 'none',
    });

    const packageJson = readJson(tree, 'package.json');

    expect(packageJson).toMatchSnapshot();
  });

  it('should support --testEnvironment=edge-runtime', () => {
    ensureDependencies(tree, {
      testEnvironment: 'edge-runtime',
      uiFramework: 'none',
    });

    const packageJson = readJson(tree, 'package.json');

    expect(packageJson).toMatchSnapshot();
  });
});
