import {
  addProjectConfiguration,
  readJson,
  updateJson,
  updateNxJson,
  type Tree,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import addOptionalModuleFederationPackages from './add-optional-module-federation-packages';

describe('add-optional-module-federation-packages migration', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    updateJson(tree, 'package.json', (json) => {
      json.devDependencies = { '@nx/react': '23.1.0' };
      return json;
    });
  });

  it('should not add any package when nothing requires them', async () => {
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      targets: { build: { executor: '@nx/vite:build' } },
    });

    await addOptionalModuleFederationPackages(tree);

    expect(readJson(tree, 'package.json').devDependencies).toEqual({
      '@nx/react': '23.1.0',
    });
  });

  it('should add @nx/module-federation for a module federation dev server target', async () => {
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      targets: {
        serve: { executor: '@nx/react:module-federation-dev-server' },
      },
    });

    await addOptionalModuleFederationPackages(tree);

    const { devDependencies } = readJson(tree, 'package.json');
    expect(devDependencies['@nx/module-federation']).toBeDefined();
    expect(devDependencies['express']).toBeUndefined();
  });

  it('should add express and http-proxy-middleware for a static server target', async () => {
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      targets: {
        'serve-static': {
          executor: '@nx/react:module-federation-static-server',
        },
      },
    });

    await addOptionalModuleFederationPackages(tree);

    const { devDependencies } = readJson(tree, 'package.json');
    expect(devDependencies['@nx/module-federation']).toBeDefined();
    expect(devDependencies['express']).toBeDefined();
    expect(devDependencies['http-proxy-middleware']).toBeDefined();
  });

  it('should add @nx/module-federation for a project with a module federation config file', async () => {
    addProjectConfiguration(tree, 'remote1', {
      root: 'apps/remote1',
      targets: { serve: { executor: '@nx/webpack:dev-server' } },
    });
    tree.write(
      'apps/remote1/module-federation.config.ts',
      'export default {};'
    );

    await addOptionalModuleFederationPackages(tree);

    expect(
      readJson(tree, 'package.json').devDependencies['@nx/module-federation']
    ).toBeDefined();
  });

  it('should detect executors inherited from targetDefaults', async () => {
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      targets: { serve: {} },
    });
    updateNxJson(tree, {
      targetDefaults: {
        serve: { executor: '@nx/react:module-federation-dev-server' },
      },
    });

    await addOptionalModuleFederationPackages(tree);

    expect(
      readJson(tree, 'package.json').devDependencies['@nx/module-federation']
    ).toBeDefined();
  });

  it('should leave an already installed package untouched', async () => {
    updateJson(tree, 'package.json', (json) => {
      json.devDependencies['@nx/module-federation'] = '23.0.0';
      return json;
    });
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      targets: {
        serve: { executor: '@nx/react:module-federation-dev-server' },
      },
    });

    await addOptionalModuleFederationPackages(tree);

    expect(
      readJson(tree, 'package.json').devDependencies['@nx/module-federation']
    ).toBe('23.0.0');
  });
});
