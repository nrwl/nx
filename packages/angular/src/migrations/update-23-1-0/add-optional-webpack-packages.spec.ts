import {
  addProjectConfiguration,
  readJson,
  updateJson,
  type Tree,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { nxVersion, webpackMergeVersion } from '../../utils/versions';
import migration from './add-optional-webpack-packages';

describe('add-optional-webpack-packages migration', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  function getDevDependencies(): Record<string, string> {
    return readJson(tree, 'package.json').devDependencies;
  }

  test.each(['@nx/angular:webpack-browser', '@nx/angular:webpack-server'])(
    'should add webpack packages for the "%s" executor',
    async (executor) => {
      addProjectConfiguration(tree, 'app1', {
        root: 'apps/app1',
        targets: { build: { executor, options: {} } },
      });

      await migration(tree);

      expect(getDevDependencies()['@nx/webpack']).toBe(nxVersion);
      expect(getDevDependencies()['webpack-merge']).toBe(webpackMergeVersion);
    }
  );

  it('should add webpack packages when dev-server points to a webpack build', async () => {
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      targets: {
        build: { executor: '@nx/angular:webpack-browser', options: {} },
        serve: {
          executor: '@nx/angular:dev-server',
          options: { buildTarget: 'app1:build' },
        },
      },
    });

    await migration(tree);

    expect(getDevDependencies()['@nx/webpack']).toBe(nxVersion);
    expect(getDevDependencies()['webpack-merge']).toBe(webpackMergeVersion);
  });

  it('should add webpack packages when dev-server points to a classic webpack build', async () => {
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      targets: {
        build: {
          executor: '@angular-devkit/build-angular:browser',
          options: {},
        },
        serve: {
          executor: '@nx/angular:dev-server',
          options: { buildTarget: 'app1:build' },
        },
      },
    });

    await migration(tree);

    expect(getDevDependencies()['@nx/webpack']).toBe(nxVersion);
    expect(getDevDependencies()['webpack-merge']).toBe(webpackMergeVersion);
  });

  it('should add webpack packages when dev-server points to a classic build inheriting its executor from targetDefaults', async () => {
    updateJson(tree, 'nx.json', (json) => ({
      ...json,
      targetDefaults: {
        build: { executor: '@angular-devkit/build-angular:browser' },
      },
    }));
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      targets: {
        build: {},
        serve: {
          executor: '@nx/angular:dev-server',
          options: { buildTarget: 'app1:build' },
        },
      },
    });

    await migration(tree);

    expect(getDevDependencies()['@nx/webpack']).toBe(nxVersion);
    expect(getDevDependencies()['webpack-merge']).toBe(webpackMergeVersion);
  });

  it('should add webpack packages when dev-server points to a webpack build via browserTarget', async () => {
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      targets: {
        build: { executor: '@nx/angular:webpack-browser', options: {} },
        serve: {
          executor: '@nx/angular:dev-server',
          options: { browserTarget: 'app1:build' },
        },
      },
    });

    await migration(tree);

    expect(getDevDependencies()['@nx/webpack']).toBe(nxVersion);
    expect(getDevDependencies()['webpack-merge']).toBe(webpackMergeVersion);
  });

  it('should add webpack packages when a dev-server configuration points to a webpack build', async () => {
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      targets: {
        build: { executor: '@nx/angular:webpack-browser', options: {} },
        serve: {
          executor: '@nx/angular:dev-server',
          options: {},
          configurations: {
            production: { buildTarget: 'app1:build' },
          },
        },
      },
    });

    await migration(tree);

    expect(getDevDependencies()['@nx/webpack']).toBe(nxVersion);
    expect(getDevDependencies()['webpack-merge']).toBe(webpackMergeVersion);
  });

  it('should add webpack packages for a target inheriting a webpack executor from targetDefaults', async () => {
    updateJson(tree, 'nx.json', (json) => ({
      ...json,
      targetDefaults: {
        build: { executor: '@nx/angular:webpack-browser' },
      },
    }));
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      targets: { build: {} },
    });

    await migration(tree);

    expect(getDevDependencies()['@nx/webpack']).toBe(nxVersion);
    expect(getDevDependencies()['webpack-merge']).toBe(webpackMergeVersion);
  });

  it('should add webpack packages for a target inheriting a webpack executor from an array-form targetDefault', async () => {
    updateJson(tree, 'nx.json', (json) => ({
      ...json,
      targetDefaults: {
        build: [{ executor: '@nx/angular:webpack-browser' }],
      },
    }));
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      targets: { build: {} },
    });

    await migration(tree);

    expect(getDevDependencies()['@nx/webpack']).toBe(nxVersion);
    expect(getDevDependencies()['webpack-merge']).toBe(webpackMergeVersion);
  });

  it('should add webpack packages for an executor-keyed array-form targetDefault', async () => {
    updateJson(tree, 'nx.json', (json) => ({
      ...json,
      targetDefaults: {
        '@nx/angular:webpack-browser': [{ cache: true }],
      },
    }));

    await migration(tree);

    expect(getDevDependencies()['@nx/webpack']).toBe(nxVersion);
    expect(getDevDependencies()['webpack-merge']).toBe(webpackMergeVersion);
  });

  test.each([
    '@nx/angular:module-federation-dev-server',
    '@nx/angular:module-federation-dev-ssr',
  ])(
    'should add @nx/module-federation for the "%s" executor',
    async (executor) => {
      addProjectConfiguration(tree, 'app1', {
        root: 'apps/app1',
        targets: { serve: { executor, options: {} } },
      });

      await migration(tree);

      expect(getDevDependencies()['@nx/module-federation']).toBe(nxVersion);
    }
  );

  test.each(['module-federation.config.ts', 'module-federation.config.js'])(
    'should add @nx/module-federation for a remote with a "%s" file and no host executor',
    async (configFile) => {
      addProjectConfiguration(tree, 'remote1', {
        root: 'apps/remote1',
        targets: {
          build: { executor: '@nx/angular:webpack-browser', options: {} },
          serve: {
            executor: '@nx/angular:dev-server',
            options: { buildTarget: 'remote1:build' },
          },
        },
      });
      tree.write(`apps/remote1/${configFile}`, 'export default {};');

      await migration(tree);

      expect(getDevDependencies()['@nx/module-federation']).toBe(nxVersion);
      expect(getDevDependencies()['@nx/webpack']).toBe(nxVersion);
    }
  );

  it('should add @nx/rspack when the rspack plugin is configured', async () => {
    updateJson(tree, 'nx.json', (json) => ({
      ...json,
      plugins: ['@nx/rspack/plugin'],
    }));

    await migration(tree);

    expect(getDevDependencies()['@nx/rspack']).toBe(nxVersion);
  });

  it('should add @nx/rspack when the rspack plugin is configured as an object', async () => {
    updateJson(tree, 'nx.json', (json) => ({
      ...json,
      plugins: [{ plugin: '@nx/rspack/plugin', options: {} }],
    }));

    await migration(tree);

    expect(getDevDependencies()['@nx/rspack']).toBe(nxVersion);
  });

  it('should not add packages for a build executor that needs none', async () => {
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      targets: {
        build: { executor: '@example/custom:build', options: {} },
      },
    });

    await migration(tree);

    expect(getDevDependencies()['@nx/webpack']).toBeUndefined();
    expect(getDevDependencies()['webpack-merge']).toBeUndefined();
    expect(getDevDependencies()['@nx/module-federation']).toBeUndefined();
    expect(getDevDependencies()['@nx/rspack']).toBeUndefined();
  });

  it('should add @nx/rspack when a target uses an @nx/rspack executor', async () => {
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      targets: {
        build: { executor: '@nx/rspack:rspack', options: {} },
      },
    });

    await migration(tree);

    expect(getDevDependencies()['@nx/rspack']).toBe(nxVersion);
  });

  it('should add @nx/rspack for a target inheriting an rspack executor from targetDefaults', async () => {
    updateJson(tree, 'nx.json', (json) => ({
      ...json,
      targetDefaults: {
        build: { executor: '@nx/rspack:rspack' },
      },
    }));
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      targets: { build: {} },
    });

    await migration(tree);

    expect(getDevDependencies()['@nx/rspack']).toBe(nxVersion);
  });

  it('should not add packages for an unreferenced classic webpack build', async () => {
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      targets: {
        build: {
          executor: '@angular-devkit/build-angular:browser',
          options: {},
        },
      },
    });

    await migration(tree);

    expect(getDevDependencies()['@nx/webpack']).toBeUndefined();
    expect(getDevDependencies()['webpack-merge']).toBeUndefined();
    expect(getDevDependencies()['@nx/module-federation']).toBeUndefined();
    expect(getDevDependencies()['@nx/rspack']).toBeUndefined();
  });

  it('should not add packages for esbuild-only targets', async () => {
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      targets: {
        build: { executor: '@nx/angular:application', options: {} },
        serve: {
          executor: '@nx/angular:dev-server',
          options: { buildTarget: 'app1:build' },
        },
      },
    });

    await migration(tree);

    expect(getDevDependencies()['@nx/webpack']).toBeUndefined();
    expect(getDevDependencies()['webpack-merge']).toBeUndefined();
    expect(getDevDependencies()['@nx/module-federation']).toBeUndefined();
    expect(getDevDependencies()['@nx/rspack']).toBeUndefined();
  });

  it('should not overwrite an existing package version', async () => {
    updateJson(tree, 'package.json', (json) => ({
      ...json,
      dependencies: { ...json.dependencies, '@nx/webpack': '~22.0.0' },
    }));
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      targets: {
        build: { executor: '@nx/angular:webpack-browser', options: {} },
      },
    });

    await migration(tree);

    expect(readJson(tree, 'package.json').dependencies['@nx/webpack']).toBe(
      '~22.0.0'
    );
    expect(getDevDependencies()['@nx/webpack']).toBeUndefined();
  });
});
