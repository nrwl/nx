import {
  addProjectConfiguration,
  readJson,
  readNxJson,
  updateJson,
  updateNxJson,
  type Tree,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { angularDevkitVersion } from '../../utils/versions';
import migration from './add-angular-build';

const angularBuildExecutors = [
  '@nx/angular:application',
  '@nx/angular:unit-test',
  '@angular/build:application',
  '@angular/build:dev-server',
];

describe('add-angular-build migration', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  function getAngularBuildVersion(): string | undefined {
    return readJson(tree, 'package.json').devDependencies?.['@angular/build'];
  }

  test.each(angularBuildExecutors)(
    'should add @angular/build when a target uses the "%s" executor',
    async (executor) => {
      addProjectConfiguration(tree, 'app1', {
        root: 'apps/app1',
        projectType: 'application',
        targets: { build: { executor, options: {} } },
      });

      await migration(tree);

      expect(getAngularBuildVersion()).toBe(angularDevkitVersion);
    }
  );

  it('should detect the executor in a library project (no projectType gate)', async () => {
    addProjectConfiguration(tree, 'lib1', {
      root: 'libs/lib1',
      projectType: 'library',
      targets: { test: { executor: '@nx/angular:unit-test', options: {} } },
    });

    await migration(tree);

    expect(getAngularBuildVersion()).toBe(angularDevkitVersion);
  });

  it('should not add @angular/build when no target uses a relevant executor', async () => {
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      projectType: 'application',
      targets: {
        build: {
          executor: '@angular-devkit/build-angular:browser',
          options: {},
        },
      },
    });

    await migration(tree);

    expect(getAngularBuildVersion()).toBeUndefined();
  });

  it('should bail out early when @angular/build is already a devDependency', async () => {
    updateJson(tree, 'package.json', (json) => {
      json.devDependencies = {
        ...json.devDependencies,
        '@angular/build': '~21.0.0',
      };
      return json;
    });
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      projectType: 'application',
      targets: { build: { executor: '@nx/angular:application', options: {} } },
    });

    await migration(tree);

    expect(getAngularBuildVersion()).toBe('~21.0.0');
  });

  it('should bail out early when @angular/build is already a dependency (not duplicated into devDependencies)', async () => {
    updateJson(tree, 'package.json', (json) => {
      json.dependencies = {
        ...json.dependencies,
        '@angular/build': '~21.0.0',
      };
      return json;
    });
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      projectType: 'application',
      targets: { build: { executor: '@nx/angular:application', options: {} } },
    });

    await migration(tree);

    const packageJson = readJson(tree, 'package.json');
    expect(packageJson.dependencies['@angular/build']).toBe('~21.0.0');
    expect(getAngularBuildVersion()).toBeUndefined();
  });

  describe('nx.json targetDefaults', () => {
    it('should detect an executor inherited from a record-shaped targetDefault keyed by target name', async () => {
      // A project `build` target with no executor inherits it from the default.
      addProjectConfiguration(tree, 'app1', {
        root: 'apps/app1',
        projectType: 'application',
        targets: { build: {} },
      });
      const nxJson = readNxJson(tree);
      nxJson.targetDefaults = {
        build: { executor: '@nx/angular:application', options: {} },
      };
      updateNxJson(tree, nxJson);

      await migration(tree);

      expect(getAngularBuildVersion()).toBe(angularDevkitVersion);
    });

    it('should detect a record-shaped targetDefault keyed by the executor', async () => {
      const nxJson = readNxJson(tree);
      nxJson.targetDefaults = {
        '@angular/build:application': { options: {} },
      };
      updateNxJson(tree, nxJson);

      await migration(tree);

      expect(getAngularBuildVersion()).toBe(angularDevkitVersion);
    });

    it('should not add @angular/build when targetDefaults do not use a relevant executor', async () => {
      const nxJson = readNxJson(tree);
      nxJson.targetDefaults = {
        build: {
          executor: '@angular-devkit/build-angular:browser',
          options: {},
        },
      };
      updateNxJson(tree, nxJson);

      await migration(tree);

      expect(getAngularBuildVersion()).toBeUndefined();
    });
  });
});
