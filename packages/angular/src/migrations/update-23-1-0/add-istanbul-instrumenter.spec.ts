import {
  addProjectConfiguration,
  readJson,
  readNxJson,
  updateJson,
  updateNxJson,
  type Tree,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import migration from './add-istanbul-instrumenter';

const istanbulLibInstrumentVersion = '^6.0.3';
const karmaBuilders = [
  '@angular-devkit/build-angular:karma',
  '@angular/build:karma',
];
const unitTestBuilders = ['@angular/build:unit-test', '@nx/angular:unit-test'];

describe('add-istanbul-instrumenter migration', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  function getInstrumenterVersion(): string | undefined {
    return readJson(tree, 'package.json').devDependencies?.[
      'istanbul-lib-instrument'
    ];
  }

  test.each(karmaBuilders)(
    'should add istanbul-lib-instrument when a target uses the "%s" Karma builder',
    async (executor) => {
      addProjectConfiguration(tree, 'app1', {
        root: 'apps/app1',
        projectType: 'application',
        targets: { test: { executor, options: {} } },
      });

      await migration(tree);

      expect(getInstrumenterVersion()).toBe(istanbulLibInstrumentVersion);
    }
  );

  test.each(unitTestBuilders)(
    'should add istanbul-lib-instrument when "%s" uses runner: karma',
    async (executor) => {
      addProjectConfiguration(tree, 'app1', {
        root: 'apps/app1',
        projectType: 'application',
        targets: { test: { executor, options: { runner: 'karma' } } },
      });

      await migration(tree);

      expect(getInstrumenterVersion()).toBe(istanbulLibInstrumentVersion);
    }
  );

  it('should detect runner: karma set only in a configuration', async () => {
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      projectType: 'application',
      targets: {
        test: {
          executor: '@nx/angular:unit-test',
          options: { runner: 'vitest' },
          configurations: { ci: { runner: 'karma' } },
        },
      },
    });

    await migration(tree);

    expect(getInstrumenterVersion()).toBe(istanbulLibInstrumentVersion);
  });

  it('should detect Karma in a library project (no projectType gate)', async () => {
    addProjectConfiguration(tree, 'lib1', {
      root: 'libs/lib1',
      projectType: 'library',
      targets: { test: { executor: '@angular/build:karma', options: {} } },
    });

    await migration(tree);

    expect(getInstrumenterVersion()).toBe(istanbulLibInstrumentVersion);
  });

  it('should not add istanbul-lib-instrument when no target uses Karma', async () => {
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      projectType: 'application',
      targets: {
        test: {
          executor: '@angular/build:unit-test',
          options: { runner: 'vitest' },
        },
      },
    });

    await migration(tree);

    expect(getInstrumenterVersion()).toBeUndefined();
  });

  it('should not overwrite an existing istanbul-lib-instrument version', async () => {
    updateJson(tree, 'package.json', (json) => {
      json.devDependencies = {
        ...json.devDependencies,
        'istanbul-lib-instrument': '^5.0.0',
      };
      return json;
    });
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      projectType: 'application',
      targets: { test: { executor: '@angular/build:karma', options: {} } },
    });

    await migration(tree);

    expect(getInstrumenterVersion()).toBe('^5.0.0');
  });

  describe('nx.json targetDefaults', () => {
    it('should detect a Karma executor inherited from a record-shaped targetDefault keyed by target name', async () => {
      // A project `test` target with no executor inherits it from the default.
      addProjectConfiguration(tree, 'app1', {
        root: 'apps/app1',
        projectType: 'application',
        targets: { test: {} },
      });
      const nxJson = readNxJson(tree);
      nxJson.targetDefaults = {
        test: { executor: '@angular/build:karma', options: {} },
      };
      updateNxJson(tree, nxJson);

      await migration(tree);

      expect(getInstrumenterVersion()).toBe(istanbulLibInstrumentVersion);
    });

    it('should detect a record-shaped targetDefault keyed by a Karma builder executor', async () => {
      const nxJson = readNxJson(tree);
      nxJson.targetDefaults = {
        '@angular-devkit/build-angular:karma': { options: {} },
      };
      updateNxJson(tree, nxJson);

      await migration(tree);

      expect(getInstrumenterVersion()).toBe(istanbulLibInstrumentVersion);
    });

    it('should detect runner: karma on a unit-test targetDefault keyed by target name', async () => {
      const nxJson = readNxJson(tree);
      nxJson.targetDefaults = {
        test: {
          executor: '@nx/angular:unit-test',
          options: { runner: 'karma' },
        },
      };
      updateNxJson(tree, nxJson);

      await migration(tree);

      expect(getInstrumenterVersion()).toBe(istanbulLibInstrumentVersion);
    });

    it('should not add istanbul-lib-instrument when targetDefaults do not use Karma', async () => {
      const nxJson = readNxJson(tree);
      nxJson.targetDefaults = {
        test: {
          executor: '@nx/angular:unit-test',
          options: { runner: 'vitest' },
        },
      };
      updateNxJson(tree, nxJson);

      await migration(tree);

      expect(getInstrumenterVersion()).toBeUndefined();
    });
  });
});
