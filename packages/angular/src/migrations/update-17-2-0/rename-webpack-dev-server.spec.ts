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
import migration from './rename-webpack-dev-server';

describe('rename-webpack-dev-server migration', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    jest
      .spyOn(devkit, 'formatFiles')
      .mockImplementation(() => Promise.resolve());
  });

  it('should replace @nx/angular:webpack-dev-server with @nx/angular:dev-server', async () => {
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      projectType: 'application',
      targets: {
        serve: {
          executor: '@nx/angular:webpack-dev-server',
          options: {},
          configurations: {},
        },
      },
    });

    await migration(tree);

    const project = readProjectConfiguration(tree, 'app1');
    expect(project.targets.serve.executor).toBe('@nx/angular:dev-server');
  });

  it('should replace @nrwl/angular:webpack-dev-server with @nx/angular:dev-server', async () => {
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      projectType: 'application',
      targets: {
        serve: {
          executor: '@nrwl/angular:webpack-dev-server',
          options: {},
          configurations: {},
        },
      },
    });

    await migration(tree);

    const project = readProjectConfiguration(tree, 'app1');
    expect(project.targets.serve.executor).toBe('@nx/angular:dev-server');
  });

  it('should replace @nx/angular:webpack-dev-server with @nx/angular:dev-server from nx.json targetDefaults keys', async () => {
    updateJson<NxJsonConfiguration>(tree, 'nx.json', (json) => {
      json.targetDefaults ??= {};
      json.targetDefaults['@nx/angular:webpack-dev-server'] = {
        options: {},
        configurations: {},
      };
      return json;
    });

    await migration(tree);

    const nxJson = readJson<NxJsonConfiguration>(tree, 'nx.json');
    expect(
      nxJson.targetDefaults['@nx/angular:webpack-dev-server']
    ).toBeUndefined();
    expect(nxJson.targetDefaults['@nx/angular:dev-server']).toBeDefined();
  });

  it('should replace @nrwl/angular:webpack-dev-server with @nx/angular:dev-server from nx.json targetDefaults keys', async () => {
    updateJson<NxJsonConfiguration>(tree, 'nx.json', (json) => {
      json.targetDefaults ??= {};
      json.targetDefaults['@nrwl/angular:webpack-dev-server'] = {
        options: {},
        configurations: {},
      };
      return json;
    });

    await migration(tree);

    const nxJson = readJson<NxJsonConfiguration>(tree, 'nx.json');
    expect(
      nxJson.targetDefaults['@nrwl/angular:webpack-dev-server']
    ).toBeUndefined();
    expect(nxJson.targetDefaults['@nx/angular:dev-server']).toBeDefined();
  });

  it('should replace @nx/angular:webpack-dev-server with @nx/angular:dev-server from nx.json targetDefaults value executors', async () => {
    updateJson<NxJsonConfiguration>(tree, 'nx.json', (json) => {
      json.targetDefaults ??= {};
      json.targetDefaults.serve = {
        executor: '@nx/angular:webpack-dev-server',
        options: {},
        configurations: {},
      };
      return json;
    });

    await migration(tree);

    const nxJson = readJson<NxJsonConfiguration>(tree, 'nx.json');
    expect(nxJson.targetDefaults.serve.executor).toBe('@nx/angular:dev-server');
  });

  it('should replace @nrwl/angular:webpack-dev-server with @nx/angular:dev-server from nx.json targetDefaults value executors', async () => {
    updateJson<NxJsonConfiguration>(tree, 'nx.json', (json) => {
      json.targetDefaults ??= {};
      json.targetDefaults.serve = {
        executor: '@nrwl/angular:webpack-dev-server',
        options: {},
        configurations: {},
      };
      return json;
    });

    await migration(tree);

    const nxJson = readJson<NxJsonConfiguration>(tree, 'nx.json');
    expect(nxJson.targetDefaults.serve.executor).toBe('@nx/angular:dev-server');
  });
});
