import type { NxJsonConfiguration } from '../../config/nx-json';
import type { TargetConfiguration } from '../../config/workspace-json-project-json';
import * as executorUtils from '../../command-line/run/executor-utils';
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

  function setDefaults(targetDefaults: NxJsonConfiguration['targetDefaults']) {
    // createTreeWithEmptyWorkspace seeds its own targetDefaults; replace them
    // outright so each fixture is exactly what the test declares.
    const nxJson = readNxJson(tree);
    delete nxJson.targetDefaults;
    updateNxJson(tree, {
      ...nxJson,
      ...(targetDefaults ? { targetDefaults } : {}),
    });
  }

  function addProject(
    name: string,
    targets: Record<string, TargetConfiguration>
  ) {
    addProjectConfiguration(tree, name, { root: `apps/${name}`, targets });
  }

  function setup(
    targetDefaults: NxJsonConfiguration['targetDefaults'],
    targets: Record<string, TargetConfiguration>
  ) {
    setDefaults(targetDefaults);
    addProject('app', targets);
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
    // `package` is outside the long-running name list and its executor's schema
    // is not continuous, so the explicit `cache: false` on the target name key
    // is the only thing that can reject this fixture.
    setup(
      {
        package: { cache: false },
        '@nx/js:tsc': { inputs: ['production'] },
      },
      { package: { executor: '@nx/js:tsc' } }
    );

    await migration(tree);

    expect(readNxJson(tree).targetDefaults['@nx/js:tsc']).toEqual({
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

  it('should set cache on the unfiltered entry of an array-shaped default', async () => {
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
        serve: { cache: true },
        '@nx/js:tsc': { inputs: ['default'] },
      },
      {
        build: { executor: '@nx/js:tsc' },
        serve: { executor: '@nx/js:tsc' },
      }
    );

    await migration(tree);

    expect(readNxJson(tree).targetDefaults['@nx/js:tsc']).toEqual({
      inputs: ['default'],
    });
  });

  it('should not enable cache on a key shared with an explicitly continuous target', async () => {
    // `api` is outside the long-running name list, so only the `continuous`
    // field on the target itself can reject this — and it is readable here.
    setup(
      {
        build: { cache: true },
        api: { cache: true },
        '@nx/js:tsc': { inputs: ['default'] },
      },
      {
        build: { executor: '@nx/js:tsc' },
        api: { executor: '@nx/js:tsc', continuous: true },
      }
    );

    await migration(tree);

    expect(readNxJson(tree).targetDefaults['@nx/js:tsc']).toEqual({
      inputs: ['default'],
    });
  });

  // Two projects routinely declare the same target name through the same
  // executor key, and only one of them may be continuous. Which of the two is
  // discovered last is not something the user controls, so the answer has to be
  // the same in both orders — hence the pair.
  it('should not enable cache when a later project makes the same target name continuous', async () => {
    setDefaults({
      build: { cache: true },
      '@nx/js:tsc': { inputs: ['default'] },
    });
    addProject('plain', { build: { executor: '@nx/js:tsc' } });
    addProject('continuous', {
      build: { executor: '@nx/js:tsc', continuous: true },
    });

    await migration(tree);

    expect(readNxJson(tree).targetDefaults['@nx/js:tsc']).toEqual({
      inputs: ['default'],
    });
  });

  it('should not enable cache when an earlier project makes the same target name continuous', async () => {
    setDefaults({
      build: { cache: true },
      '@nx/js:tsc': { inputs: ['default'] },
    });
    addProject('continuous', {
      build: { executor: '@nx/js:tsc', continuous: true },
    });
    addProject('plain', { build: { executor: '@nx/js:tsc' } });

    await migration(tree);

    expect(readNxJson(tree).targetDefaults['@nx/js:tsc']).toEqual({
      inputs: ['default'],
    });
  });

  it('should not enable cache on a key that declares continuous itself', async () => {
    // The key gives every target through it `continuous: true`; adding `cache`
    // makes each of them fail graph construction.
    setup(
      {
        build: { cache: true },
        '@nx/js:tsc': { inputs: ['default'], continuous: true },
      },
      { build: { executor: '@nx/js:tsc' } }
    );

    await migration(tree);

    expect(readNxJson(tree).targetDefaults['@nx/js:tsc']).toEqual({
      inputs: ['default'],
      continuous: true,
    });
  });

  it('should not enable cache on a key whose only continuous declaration is filtered', async () => {
    setup(
      {
        build: { cache: true },
        '@nx/js:tsc': [
          { inputs: ['default'] },
          { filter: { projects: ['app'] }, continuous: true },
        ],
      },
      { build: { executor: '@nx/js:tsc' } }
    );

    await migration(tree);

    expect(readNxJson(tree).targetDefaults['@nx/js:tsc']).toEqual([
      { inputs: ['default'] },
      { filter: { projects: ['app'] }, continuous: true },
    ]);
  });

  it('should see targets declared in a package.json next to a project.json', async () => {
    // The package.json plugin creates a node for any package.json that sits
    // next to a project.json, but getProjects builds that root from the
    // project.json alone — so `api` is only reachable by reading the
    // package.json directly.
    setup(
      { build: { cache: true }, '@nx/js:tsc': { inputs: ['default'] } },
      { build: { executor: '@nx/js:tsc' } }
    );
    tree.write(
      'apps/app/package.json',
      JSON.stringify({
        name: 'app',
        nx: { targets: { api: { executor: '@nx/js:tsc', continuous: true } } },
      })
    );

    await migration(tree);

    expect(readNxJson(tree).targetDefaults['@nx/js:tsc']).toEqual({
      inputs: ['default'],
    });
  });

  it('should still enable cache when the sibling package.json targets also opt in', async () => {
    setup(
      {
        build: { cache: true },
        package: { cache: true },
        '@nx/js:tsc': { inputs: ['default'] },
      },
      { build: { executor: '@nx/js:tsc' } }
    );
    tree.write(
      'apps/app/package.json',
      JSON.stringify({
        name: 'app',
        nx: { targets: { package: { executor: '@nx/js:tsc' } } },
      })
    );

    await migration(tree);

    expect(readNxJson(tree).targetDefaults['@nx/js:tsc']).toEqual({
      inputs: ['default'],
      cache: true,
    });
  });

  it('should never enable cache on the nx:run-script key', async () => {
    // Targets derived from `package.json` scripts resolve through this key
    // without declaring it, so the target list here is never complete —
    // stamping it would make every script in the workspace cacheable.
    setup(
      { build: { cache: true }, 'nx:run-script': { inputs: ['default'] } },
      { build: { executor: 'nx:run-script' } }
    );

    await migration(tree);

    expect(readNxJson(tree).targetDefaults['nx:run-script']).toEqual({
      inputs: ['default'],
    });
  });

  it('should never enable cache on the nx:run-commands key', async () => {
    // `command` targets resolve through this key without declaring an executor,
    // and plugins infer continuous ones that are invisible here, so the target
    // list can never be trusted to be complete.
    setup(
      { build: { cache: true }, 'nx:run-commands': { inputs: ['default'] } },
      { build: { executor: 'nx:run-commands' } }
    );

    await migration(tree);

    expect(readNxJson(tree).targetDefaults['nx:run-commands']).toEqual({
      inputs: ['default'],
    });
  });

  it('should not enable cache on a key whose executor schema is continuous', async () => {
    // Real executors such as @nx/js:verdaccio declare "continuous": true in
    // their shipped schema, making every target through the key continuous
    // after normalization. The schema is stubbed because the in-memory tree
    // root has no node_modules to resolve against.
    const getExecutorInformation = jest
      .spyOn(executorUtils, 'getExecutorInformation')
      .mockReturnValue({ schema: { continuous: true } } as any);

    setup(
      {
        'local-registry': { cache: true },
        '@nx/js:verdaccio': { inputs: ['default'] },
      },
      { 'local-registry': { executor: '@nx/js:verdaccio' } }
    );

    await migration(tree);

    expect(getExecutorInformation).toHaveBeenCalled();
    expect(readNxJson(tree).targetDefaults['@nx/js:verdaccio']).toEqual({
      inputs: ['default'],
    });

    getExecutorInformation.mockRestore();
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
    // "cache only for legacy-app, nobody else". Reading past the filter would
    // resolve the key to `true` and widen it to every project through the
    // executor key — the opposite of what the config says.
    setup(
      {
        build: [
          { cache: false },
          { filter: { projects: ['legacy-app'] }, cache: true },
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

  it('should leave an executor key whose only cache declaration is filtered alone', async () => {
    setup(
      {
        build: { cache: true },
        '@nx/angular:webpack-browser': [
          { inputs: ['production'] },
          { filter: { projects: ['legacy-app'] }, cache: false },
        ],
      },
      { build: { executor: '@nx/angular:webpack-browser' } }
    );

    await migration(tree);

    expect(
      readNxJson(tree).targetDefaults['@nx/angular:webpack-browser']
    ).toEqual([
      { inputs: ['production'] },
      { filter: { projects: ['legacy-app'] }, cache: false },
    ]);
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
