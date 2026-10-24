import {
  addProjectConfiguration,
  readJson,
  updateJson,
  writeJson,
  type Tree,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import migration from './upgrade-to-angular-22-2';

describe('upgrade-to-angular-22-2 migration', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    updateJson(tree, 'package.json', (json) => ({
      ...json,
      dependencies: { '@angular/core': '~22.1.0' },
      devDependencies: {},
    }));
  });

  function readAngularCore(): string {
    return readJson(tree, 'package.json').dependencies['@angular/core'];
  }

  function addWebpackProject(
    name: string,
    target: Record<string, unknown>
  ): void {
    addProjectConfiguration(tree, name, {
      root: `apps/${name}`,
      targets: { build: target },
    });
  }

  it('should update the declared Angular packages and add @angular/core', async () => {
    updateJson(tree, 'package.json', (json) => ({
      ...json,
      dependencies: { '@angular/common': '~22.1.0' },
      devDependencies: {
        '@angular/cli': '~22.1.0',
        '@angular-devkit/architect': '~0.2201.0',
      },
    }));

    await migration(tree);

    const { dependencies, devDependencies } = readJson(tree, 'package.json');
    expect(dependencies).toEqual({
      '@angular/common': '~22.2.0',
      '@angular/core': '~22.2.0',
    });
    expect(devDependencies).toEqual({
      '@angular/cli': '~22.2.0',
      '@angular-devkit/architect': '~0.2202.0',
    });
  });

  test.each([
    `import { mount } from 'cypress/angular';`,
    `import { nxComponentTestingPreset } from '@nx/angular/plugins/component-testing';`,
  ])(
    'should keep Angular 22.1 for Cypress component testing (%s)',
    async (content) => {
      tree.write('libs/ui/cypress/support/component.ts', content);

      const result = await migration(tree);

      expect(readAngularCore()).toBe('~22.1.0');
      expect(result.nextSteps).toEqual([
        'Kept Angular 22.1. Cypress component testing (libs/ui/cypress/support/component.ts) fails with the webpack-dev-server 6 that Angular 22.2 installs (https://github.com/cypress-io/cypress/issues/34259). A later Nx migration updates Angular once these issues are fixed. To update before then, move the Angular packages to 22.2 by hand and work around the issues.',
      ]);
    }
  );

  test.each([
    {
      executor: '@nx/angular:webpack-browser',
      options: { customWebpackConfig: { path: 'tools/webpack/config.ts' } },
    },
    {
      executor: 'ngx-build-plus:browser',
      configurations: {
        production: { extraWebpackConfig: 'tools/webpack/config.ts' },
      },
    },
    {
      executor: 'ngx-build-plus:browser',
      options: { plugin: '~tools/webpack/config.ts' },
    },
  ])(
    'should keep Angular 22.1 when the webpack config of $executor imports Module Federation through a relative import',
    async (target) => {
      addWebpackProject('host', target);
      tree.write(
        'tools/webpack/config.ts',
        `import { withMf } from './with-mf';\nexport default withMf();`
      );
      tree.write(
        'tools/webpack/with-mf.ts',
        `import { withModuleFederation } from '@nx/module-federation/angular';\nexport const withMf = () => withModuleFederation({ name: 'host' });`
      );

      const result = await migration(tree);

      expect(readAngularCore()).toBe('~22.1.0');
      expect(result.nextSteps[0]).toContain(
        'Module Federation builds (tools/webpack/with-mf.ts) fail'
      );
    }
  );

  it('should keep Angular 22.1 for the default webpack config of an angular.json custom-webpack project', async () => {
    writeJson(tree, 'apps/legacy/angular.json', {
      projects: {
        mfe1: {
          root: 'projects/mfe1',
          architect: {
            build: {
              builder: '@angular-builders/custom-webpack:browser',
              options: { customWebpackConfig: {} },
            },
          },
        },
      },
    });
    tree.write(
      'apps/legacy/webpack.config.js',
      `const { ModuleFederationPlugin } = require('@module-federation/enhanced/webpack');`
    );

    const result = await migration(tree);

    expect(readAngularCore()).toBe('~22.1.0');
    expect(result.nextSteps[0]).toContain(
      'Module Federation builds (apps/legacy/webpack.config.js) fail'
    );
  });

  it('should keep Angular 22.1 for a webpack config in the root of a project inheriting its executor from project-filtered targetDefaults', async () => {
    updateJson(tree, 'nx.json', (json) => ({
      ...json,
      targetDefaults: {
        build: [
          {
            filter: { projects: ['remote'] },
            executor: '@nx/angular:webpack-browser',
          },
        ],
      },
    }));
    addWebpackProject('remote', { options: {} });
    tree.write(
      'apps/remote/webpack.prod.config.ts',
      `import { withModuleFederation } from '@nx/module-federation/angular';`
    );

    const result = await migration(tree);

    expect(readAngularCore()).toBe('~22.1.0');
    expect(result.nextSteps[0]).toContain(
      'Module Federation builds (apps/remote/webpack.prod.config.ts) fail'
    );
  });

  test.each([
    [
      'installed in node_modules',
      () =>
        writeJson(tree, 'node_modules/webpack-merge/package.json', {
          name: 'webpack-merge',
        }),
    ],
    [
      'declared in package.json under Yarn PnP',
      () =>
        updateJson(tree, 'package.json', (json) => ({
          ...json,
          devDependencies: { 'webpack-merge': '^6.0.0' },
        })),
    ],
  ])(
    'should update Angular when only non-Angular builds import Module Federation (webpack-merge %s)',
    async (_, installWebpackMerge) => {
      addWebpackProject('app', {
        executor: '@nx/angular:webpack-browser',
        options: {
          customWebpackConfig: { path: 'apps/app/webpack.config.js' },
        },
      });
      tree.write(
        'apps/app/webpack.config.js',
        `const { merge } = require('webpack-merge');\nconst { join } = require('node:path');`
      );
      installWebpackMerge();
      tree.write(
        'apps/react-host/webpack.config.ts',
        `import { withModuleFederation } from '@nx/module-federation/webpack';`
      );

      await migration(tree);

      expect(readAngularCore()).toBe('~22.2.0');
    }
  );

  it('should keep Angular 22.1 when a webpack config imports a workspace package and Module Federation is imported in the workspace', async () => {
    addWebpackProject('host', {
      executor: '@nx/angular:webpack-browser',
      options: { customWebpackConfig: { path: 'apps/host/webpack.config.ts' } },
    });
    tree.write(
      'apps/host/webpack.config.ts',
      `import { withMf } from '@myorg/webpack-utils';`
    );
    writeJson(tree, 'libs/webpack-utils/package.json', {
      name: '@myorg/webpack-utils',
    });
    updateJson(tree, 'package.json', (json) => ({
      ...json,
      devDependencies: { '@myorg/webpack-utils': 'workspace:*' },
    }));
    writeJson(tree, 'node_modules/@myorg/webpack-utils/package.json', {
      name: '@myorg/webpack-utils',
    });
    tree.write(
      'libs/webpack-utils/src/index.ts',
      `export { withModuleFederation as withMf } from '@nx/module-federation/angular';`
    );

    const result = await migration(tree);

    expect(readAngularCore()).toBe('~22.1.0');
    expect(result.nextSteps[0]).toContain(
      'libs/webpack-utils/src/index.ts import it, and the migration could not tell whether an Angular webpack build does: apps/host/webpack.config.ts loads "@myorg/webpack-utils", which is not an installed package'
    );
  });

  it('should update Angular when Module Federation and Cypress component testing appear only in comments', async () => {
    addWebpackProject('app', {
      executor: '@nx/angular:webpack-browser',
      options: { customWebpackConfig: { path: 'apps/app/webpack.config.ts' } },
    });
    tree.write(
      'apps/app/webpack.config.ts',
      `import { shared } from '@myorg/alias';`
    );
    tree.write(
      'libs/notes/src/index.ts',
      `// Moving to @module-federation/enhanced and cypress/angular next.`
    );

    await migration(tree);

    expect(readAngularCore()).toBe('~22.2.0');
  });
});
