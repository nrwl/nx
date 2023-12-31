import {
  addProjectConfiguration,
  readJson,
  readProjectConfiguration,
  updateJson,
  type NxJsonConfiguration,
  type Tree,
} from '@nx/devkit';
import * as devkit from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import migration from './replace-nguniversal-builders';

describe('replace-nguniversal-builders migration', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    jest
      .spyOn(devkit, 'formatFiles')
      .mockImplementation(() => Promise.resolve());
  });

  it.each([
    [
      '@nguniversal/builders:ssr-dev-server',
      'serve-ssr',
      '@angular-devkit/build-angular:ssr-dev-server',
    ],
    [
      '@nguniversal/builders:prerender',
      'prerender',
      '@angular-devkit/build-angular:prerender',
    ],
  ])(
    `should replace "%s" with "%s" from project configurations`,
    async (fromExecutor, target, toExecutor) => {
      addProjectConfiguration(tree, 'app1', {
        root: 'apps/app1',
        projectType: 'application',
        targets: {
          [target]: {
            executor: fromExecutor,
            options: {},
            configurations: {},
          },
        },
      });

      await migration(tree);

      const project = readProjectConfiguration(tree, 'app1');
      expect(project.targets[target].executor).toBe(toExecutor);
    }
  );

  it('should replace the old "@nguniversal/builders:prerender" options', async () => {
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      projectType: 'application',
      targets: {
        prerender: {
          executor: '@nguniversal/builders:prerender',
          options: {
            browserTarget: 'appprerender:build:production',
            serverTarget: 'appprerender:server:production',
            numProcesses: 1,
            guessRoutes: false,
          },
        },
      },
    });

    await migration(tree);

    const project = readProjectConfiguration(tree, 'app1');
    const { guessRoutes, numProcesses, discoverRoutes } =
      project.targets.prerender.options;
    expect(guessRoutes).toBeUndefined();
    expect(discoverRoutes).toBe(false);
    expect(numProcesses).toBeUndefined();
  });

  it.each([
    [
      '@nguniversal/builders:ssr-dev-server',
      '@angular-devkit/build-angular:ssr-dev-server',
    ],
    [
      '@nguniversal/builders:prerender',
      '@angular-devkit/build-angular:prerender',
    ],
  ])(
    `should replace "%s" with "%s" from nx.json targetDefaults keys`,
    async (fromExecutor, toExecutor) => {
      updateJson<NxJsonConfiguration>(tree, 'nx.json', (json) => {
        json.targetDefaults ??= {};
        json.targetDefaults[fromExecutor] = {
          options: {},
          configurations: {},
        };
        return json;
      });

      await migration(tree);

      const nxJson = readJson<NxJsonConfiguration>(tree, 'nx.json');
      expect(nxJson.targetDefaults[fromExecutor]).toBeUndefined();
      expect(nxJson.targetDefaults[toExecutor]).toBeDefined();
    }
  );

  it('should replace options from nx.json targetDefaults with executor "@nguniversal/builders:prerender" as the key', async () => {
    updateJson<NxJsonConfiguration>(tree, 'nx.json', (json) => {
      json.targetDefaults ??= {};
      json.targetDefaults['@nguniversal/builders:prerender'] = {
        options: {
          browserTarget: 'appprerender:build:production',
          serverTarget: 'appprerender:server:production',
          numProcesses: 1,
          guessRoutes: false,
        },
      };
      return json;
    });

    await migration(tree);

    const nxJson = readJson<NxJsonConfiguration>(tree, 'nx.json');
    const { guessRoutes, numProcesses, discoverRoutes } =
      nxJson.targetDefaults['@angular-devkit/build-angular:prerender'].options;
    expect(guessRoutes).toBeUndefined();
    expect(discoverRoutes).toBe(false);
    expect(numProcesses).toBeUndefined();
  });

  it.each([
    [
      '@nguniversal/builders:ssr-dev-server',
      'serve-ssr',
      '@angular-devkit/build-angular:ssr-dev-server',
    ],
    [
      '@nguniversal/builders:prerender',
      'prerender',
      '@angular-devkit/build-angular:prerender',
    ],
  ])(
    `should replace "%s" with "%s" from nx.json targetDefaults value executors`,
    async (fromExecutor, target, toExecutor) => {
      updateJson<NxJsonConfiguration>(tree, 'nx.json', (json) => {
        json.targetDefaults ??= {};
        json.targetDefaults[target] = {
          executor: fromExecutor,
          options: {},
          configurations: {},
        };
        return json;
      });

      await migration(tree);

      const nxJson = readJson<NxJsonConfiguration>(tree, 'nx.json');
      expect(nxJson.targetDefaults[target].executor).toBe(toExecutor);
    }
  );

  it('should replace options from nx.json targetDefaults with executor "@nguniversal/builders:prerender"', async () => {
    updateJson<NxJsonConfiguration>(tree, 'nx.json', (json) => {
      json.targetDefaults ??= {};
      json.targetDefaults.prerender = {
        executor: '@nguniversal/builders:prerender',
        options: {
          browserTarget: 'appprerender:build:production',
          serverTarget: 'appprerender:server:production',
          numProcesses: 1,
          guessRoutes: false,
        },
      };
      return json;
    });

    await migration(tree);

    const nxJson = readJson<NxJsonConfiguration>(tree, 'nx.json');
    const { guessRoutes, numProcesses, discoverRoutes } =
      nxJson.targetDefaults.prerender.options;
    expect(guessRoutes).toBeUndefined();
    expect(discoverRoutes).toBe(false);
    expect(numProcesses).toBeUndefined();
  });

  it('should remove the "@nguniversal/builders" package', async () => {
    updateJson(tree, 'package.json', (json) => {
      json.devDependencies = {
        ...json.devDependencies,
        '@nguniversal/builders': '16.0.0',
      };
      return json;
    });

    await migration(tree);

    const { devDependencies } = readJson(tree, 'package.json');
    expect(devDependencies['@nguniversal/builders']).toBeUndefined();
  });
});
