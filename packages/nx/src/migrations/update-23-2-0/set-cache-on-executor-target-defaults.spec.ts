import type { NxJsonConfiguration } from '../../config/nx-json';
import { createTreeWithEmptyWorkspace } from '../../generators/testing-utils/create-tree-with-empty-workspace';
import { Tree } from '../../generators/tree';
import {
  addProjectConfiguration,
  readNxJson,
  updateNxJson,
} from '../../generators/utils/project-configuration';
import migration from './set-cache-on-executor-target-defaults';

describe('set-cache-on-executor-target-defaults migration', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  function setup(
    targetDefaults: NxJsonConfiguration['targetDefaults'],
    targets: Record<string, { executor: string }>
  ) {
    updateNxJson(tree, { ...readNxJson(tree), targetDefaults });
    addProjectConfiguration(tree, 'app', { root: 'apps/app', targets });
  }

  it('should set cache on the executor key that shadowed the target name key', async () => {
    setup(
      {
        build: { cache: true, dependsOn: ['^build'] },
        '@nx/angular:webpack-browser': { inputs: ['production'] },
      },
      { build: { executor: '@nx/angular:webpack-browser' } }
    );

    await migration(tree);

    expect(readNxJson(tree).targetDefaults).toEqual({
      build: { cache: true, dependsOn: ['^build'] },
      '@nx/angular:webpack-browser': { inputs: ['production'], cache: true },
    });
  });

  it('should leave an executor key that already declares cache alone', async () => {
    setup(
      {
        build: { cache: true },
        '@angular/build:application': { cache: false },
      },
      { build: { executor: '@angular/build:application' } }
    );

    await migration(tree);

    expect(
      readNxJson(tree).targetDefaults['@angular/build:application']
    ).toEqual({ cache: false });
  });

  it('should not touch executor keys whose target name key does not enable cache', async () => {
    setup(
      {
        serve: { cache: false },
        '@nx/angular:dev-server': { inputs: ['production'] },
      },
      { serve: { executor: '@nx/angular:dev-server' } }
    );

    await migration(tree);

    expect(readNxJson(tree).targetDefaults['@nx/angular:dev-server']).toEqual({
      inputs: ['production'],
    });
  });

  it('should only touch executor keys backed by a real shadowed target', async () => {
    setup(
      {
        build: { cache: true },
        // No project uses this executor, so nothing was shadowed by it.
        '@nx/webpack:webpack': { inputs: ['production'] },
      },
      { build: { executor: '@nx/angular:webpack-browser' } }
    );

    await migration(tree);

    expect(readNxJson(tree).targetDefaults['@nx/webpack:webpack']).toEqual({
      inputs: ['production'],
    });
  });

  it('should set cache on the last catch-all entry of an array-shaped default', async () => {
    setup(
      {
        build: { cache: true },
        '@nx/angular:webpack-browser': [
          { filter: { projects: ['other'] }, inputs: ['default'] },
          { inputs: ['production'] },
        ],
      },
      { build: { executor: '@nx/angular:webpack-browser' } }
    );

    await migration(tree);

    expect(
      readNxJson(tree).targetDefaults['@nx/angular:webpack-browser']
    ).toEqual([
      { filter: { projects: ['other'] }, inputs: ['default'] },
      { inputs: ['production'], cache: true },
    ]);
  });

  it('should be a no-op when no target default is shadowed', async () => {
    setup(
      { build: { cache: true } },
      {
        build: { executor: '@nx/angular:webpack-browser' },
      }
    );
    const before = tree.read('nx.json').toString();

    await migration(tree);

    expect(tree.read('nx.json').toString()).toEqual(before);
  });

  it('should be a no-op when there are no target defaults', async () => {
    addProjectConfiguration(tree, 'app', {
      root: 'apps/app',
      targets: { build: { executor: '@nx/angular:webpack-browser' } },
    });

    await expect(migration(tree)).resolves.not.toThrow();
  });

  it('should change nothing on a second run', async () => {
    setup(
      {
        build: { cache: true },
        '@nx/angular:webpack-browser': { inputs: ['production'] },
      },
      { build: { executor: '@nx/angular:webpack-browser' } }
    );

    await migration(tree);
    const afterFirstRun = tree.read('nx.json').toString();
    await migration(tree);

    expect(tree.read('nx.json').toString()).toEqual(afterFirstRun);
  });

  it('should update every shadowed executor key in one pass', async () => {
    setup(
      {
        build: { cache: true },
        test: { cache: true },
        lint: { cache: true },
        '@nx/angular:webpack-browser': { inputs: ['production'] },
        '@nx/jest:jest': { inputs: ['default'] },
        // Already declares cache, so it must survive untouched alongside the
        // keys that are being rewritten.
        '@nx/eslint:lint': { cache: false },
      },
      {
        build: { executor: '@nx/angular:webpack-browser' },
        test: { executor: '@nx/jest:jest' },
        lint: { executor: '@nx/eslint:lint' },
      }
    );

    await migration(tree);

    expect(readNxJson(tree).targetDefaults).toEqual({
      build: { cache: true },
      test: { cache: true },
      lint: { cache: true },
      '@nx/angular:webpack-browser': { inputs: ['production'], cache: true },
      '@nx/jest:jest': { inputs: ['default'], cache: true },
      '@nx/eslint:lint': { cache: false },
    });
  });
});
