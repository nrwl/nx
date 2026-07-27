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
    // createTreeWithEmptyWorkspace seeds its own targetDefaults; replace them
    // outright so each fixture is exactly what the test declares.
    const nxJson = readNxJson(tree);
    delete nxJson.targetDefaults;
    updateNxJson(tree, {
      ...nxJson,
      ...(targetDefaults ? { targetDefaults } : {}),
    });
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
    setup(undefined, { build: { executor: '@nx/angular:webpack-browser' } });
    const before = tree.read('nx.json').toString();

    await expect(migration(tree)).resolves.not.toThrow();

    expect(readNxJson(tree).targetDefaults).toBeUndefined();
    expect(tree.read('nx.json').toString()).toEqual(before);
  });

  it('should not enable cache on a key shared with a long-running target', async () => {
    // `serve` resolves through the same executor key, so stamping it would make
    // a continuous target cacheable and break graph construction.
    setup(
      {
        build: { cache: true },
        serve: { cache: false },
        'nx:run-commands': { inputs: ['default'] },
      },
      {
        build: { executor: 'nx:run-commands' },
        serve: { executor: 'nx:run-commands' },
      }
    );

    await migration(tree);

    expect(readNxJson(tree).targetDefaults['nx:run-commands']).toEqual({
      inputs: ['default'],
    });
    expect(readNxJson(tree).targetDefaults['serve']).toEqual({ cache: false });
  });

  it('should not enable cache on a key shared with a target that does not want it', async () => {
    setup(
      {
        build: { cache: true },
        // No `cache`, so this target never opted in.
        package: {},
        '@nx/js:tsc': { inputs: ['production'] },
      },
      {
        build: { executor: '@nx/js:tsc' },
        package: { executor: '@nx/js:tsc' },
      }
    );

    await migration(tree);

    expect(readNxJson(tree).targetDefaults['@nx/js:tsc']).toEqual({
      inputs: ['production'],
    });
  });

  it('should not append a catch-all to an all-filtered executor key', async () => {
    // Appending one would make the key match targets that previously fell
    // through to the `build` key, dropping its dependsOn and inputs.
    setup(
      {
        build: { cache: true, dependsOn: ['^build'], inputs: ['production'] },
        '@nx/angular:webpack-browser': [
          { filter: { projects: ['other'] }, inputs: ['x'] },
        ],
      },
      { build: { executor: '@nx/angular:webpack-browser' } }
    );

    await migration(tree);

    expect(
      readNxJson(tree).targetDefaults['@nx/angular:webpack-browser']
    ).toEqual([{ filter: { projects: ['other'] }, inputs: ['x'] }]);
  });

  it('should leave the executor key alone when a filtered entry decides cache', async () => {
    // Whether the per-project opt-out applies cannot be evaluated here, so the
    // value is treated as already decided.
    setup(
      {
        build: [
          { cache: true },
          { filter: { projects: ['legacy-app'] }, cache: false },
        ],
        '@nx/angular:webpack-browser': { inputs: ['production'] },
      },
      { build: { executor: '@nx/angular:webpack-browser' } }
    );

    await migration(tree);

    expect(
      readNxJson(tree).targetDefaults['@nx/angular:webpack-browser']
    ).toEqual({ inputs: ['production'] });
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
