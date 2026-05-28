import { addDependenciesToPackageJson, readJson, type Tree } from '@nx/devkit';
import { TempFs } from '@nx/devkit/internal-testing-utils';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { ensureDependencies } from './ensure-dependencies';
import {
  nxVersion,
  vitePluginReactV4Version,
  vitePluginReactVersion,
} from './versions';

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

  it('should default to latest @vitejs/plugin-react when vite range is unparseable', () => {
    addDependenciesToPackageJson(tree, {}, { vite: 'workspace:*' });

    ensureDependencies(tree, { uiFramework: 'react' });

    const packageJson = readJson(tree, 'package.json');
    expect(packageJson.devDependencies['@vitejs/plugin-react']).toEqual(
      vitePluginReactVersion
    );
  });

  describe('with pnpm catalog references', () => {
    let tempFs: TempFs;

    beforeEach(() => {
      tempFs = new TempFs('vite-ensure-deps');
      tree.root = tempFs.tempDir;
      // force `detectPackageManager` to return `pnpm`
      tempFs.createFileSync('pnpm-lock.yaml', 'lockfileVersion: 9.0');
    });

    afterEach(() => {
      tempFs.cleanup();
    });

    it('should resolve a named catalog reference when picking @vitejs/plugin-react', () => {
      addDependenciesToPackageJson(tree, {}, { vite: 'catalog:tooling' });
      tree.write(
        'pnpm-workspace.yaml',
        `catalogs:\n  tooling:\n    vite: "^7.3.2"\n`
      );

      ensureDependencies(tree, { uiFramework: 'react' });

      const packageJson = readJson(tree, 'package.json');
      expect(packageJson.devDependencies['@vitejs/plugin-react']).toEqual(
        vitePluginReactV4Version
      );
    });

    it('should resolve a default catalog reference when picking @vitejs/plugin-react', () => {
      addDependenciesToPackageJson(tree, {}, { vite: 'catalog:' });
      tree.write('pnpm-workspace.yaml', `catalog:\n  vite: "^8.0.0"\n`);

      ensureDependencies(tree, { uiFramework: 'react' });

      const packageJson = readJson(tree, 'package.json');
      expect(packageJson.devDependencies['@vitejs/plugin-react']).toEqual(
        vitePluginReactVersion
      );
    });

    it('should default to latest @vitejs/plugin-react when catalog entry is missing', () => {
      addDependenciesToPackageJson(tree, {}, { vite: 'catalog:tooling' });
      tree.write('pnpm-workspace.yaml', `catalogs:\n  tooling: {}\n`);

      ensureDependencies(tree, { uiFramework: 'react' });

      const packageJson = readJson(tree, 'package.json');
      expect(packageJson.devDependencies['@vitejs/plugin-react']).toEqual(
        vitePluginReactVersion
      );
    });
  });
});
