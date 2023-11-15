import { NxJsonConfiguration } from '../../config/nx-json';
import { createTreeWithEmptyWorkspace } from '../../generators/testing-utils/create-tree-with-empty-workspace';
import { readJson, writeJson } from '../../generators/utils/json';
import { Tree } from '../../generators/tree';

const verifyOrUpdateNxCloudClient = jest.fn();
jest.mock('../../nx-cloud/update-manager', () => ({
  ...jest.requireActual('../../nx-cloud/update-manager'),
  verifyOrUpdateNxCloudClient,
}));
import migrate from './use-minimal-config-for-tasks-runner-options';

describe('use-minimal-config-for-tasks-runner-options migration', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should update nx.json with minimal config', async () => {
    writeJson<NxJsonConfiguration>(tree, 'nx.json', {
      tasksRunnerOptions: {
        default: {
          runner: 'nx/tasks-runners/default',
          options: {
            cacheableOperations: ['build', 'test'],
          },
        },
      },
    });

    await migrate(tree);

    const nxJson = readJson<NxJsonConfiguration>(tree, 'nx.json');
    expect(nxJson.tasksRunnerOptions).toEqual(undefined);
    expect(nxJson.targetDefaults).toMatchInlineSnapshot(`
      {
        "build": {
          "cache": true,
        },
        "test": {
          "cache": true,
        },
      }
    `);
  });

  it('should not update nx.json if there are multiple tasks runners', async () => {
    writeJson<NxJsonConfiguration>(tree, 'nx.json', {
      tasksRunnerOptions: {
        default: {
          runner: 'nx/tasks-runners/default',
          options: {},
        },
        custom: {
          runner: 'custom',
          options: {},
        },
      },
    });

    await migrate(tree);

    const nxJson = readJson<NxJsonConfiguration>(tree, 'nx.json');
    expect(nxJson.tasksRunnerOptions).toEqual({
      default: {
        runner: 'nx/tasks-runners/default',
        options: {},
      },
      custom: {
        runner: 'custom',
        options: {},
      },
    });
  });

  it('should move nxCloudAccessToken and nxCloudUrl for nx-cloud', async () => {
    writeJson<NxJsonConfiguration>(tree, 'nx.json', {
      tasksRunnerOptions: {
        default: {
          runner: 'nx-cloud',
          options: {
            accessToken: 'abc123',
            url: 'https://nx.app',
            encryptionKey: 'secret',
          },
        },
      },
    });
    writeJson(tree, 'package.json', {
      devDependencies: {
        'nx-cloud': 'latest',
        nx: 'latest',
      },
    });

    await migrate(tree);

    const nxJson = readJson<NxJsonConfiguration>(tree, 'nx.json');
    expect(nxJson.nxCloudAccessToken).toEqual('abc123');
    expect(nxJson.nxCloudUrl).toEqual('https://nx.app');
    expect(nxJson.nxCloudEncryptionKey).toEqual('secret');
    expect(nxJson.tasksRunnerOptions).not.toBeDefined();

    expect(readJson(tree, 'package.json').devDependencies).toEqual({
      nx: 'latest',
    });
  });

  it('should move nxCloudAccessToken and nxCloudUrl for @nrwl/nx-cloud', async () => {
    writeJson<NxJsonConfiguration>(tree, 'nx.json', {
      tasksRunnerOptions: {
        default: {
          runner: '@nrwl/nx-cloud',
          options: {
            accessToken: 'abc123',
            url: 'https://nx.app',
            maskedProperties: 'secret',
          },
        },
      },
    });

    await migrate(tree);

    const nxJson = readJson<NxJsonConfiguration>(tree, 'nx.json');
    expect(nxJson.nxCloudAccessToken).toEqual('abc123');
    expect(nxJson.nxCloudUrl).toEqual('https://nx.app');
    expect(nxJson.tasksRunnerOptions.default.options).toMatchInlineSnapshot(`
      {
        "maskedProperties": "secret",
      }
    `);
    expect(nxJson.tasksRunnerOptions.default.runner).not.toBeDefined();
  });

  it('should add useLightClient false for outdated enterprise customers', async () => {
    writeJson<NxJsonConfiguration>(tree, 'nx.json', {
      tasksRunnerOptions: {
        default: {
          runner: 'nx-cloud',
          options: {
            accessToken: 'abc123',
            url: 'https://nx-cloud.example.com',
          },
        },
      },
    });
    verifyOrUpdateNxCloudClient.mockImplementation(() => {
      throw new Error();
    });

    await migrate(tree);

    const nxJson = readJson<NxJsonConfiguration>(tree, 'nx.json');
    expect(nxJson.nxCloudAccessToken).toEqual('abc123');
    expect(nxJson.nxCloudUrl).toEqual('https://nx-cloud.example.com');
    expect(nxJson.tasksRunnerOptions.default.options).toMatchInlineSnapshot(`
      {
        "useLightClient": false,
      }
    `);
    expect(nxJson.tasksRunnerOptions.default.runner).not.toBeDefined();
  });

  it('should not update accessToken if runner is not nx-cloud', async () => {
    writeJson<NxJsonConfiguration>(tree, 'nx.json', {
      tasksRunnerOptions: {
        default: {
          runner: 'custom',
          options: {
            cacheDirectory: '.nx/cache',
            useDaemonProcess: false,
            accessToken: 'xxxx-xxx-xxxx',
          },
        },
      },
    });
    await migrate(tree);
    expect(readJson<NxJsonConfiguration>(tree, 'nx.json'))
      .toMatchInlineSnapshot(`
      {
        "cacheDirectory": ".nx/cache",
        "tasksRunnerOptions": {
          "default": {
            "options": {
              "accessToken": "xxxx-xxx-xxxx",
            },
            "runner": "custom",
          },
        },
        "useDaemonProcess": false,
      }
    `);
  });

  it('should work if nx.json does not exist', async () => {
    tree.delete('nx.json');
    await migrate(tree);
    expect(tree.exists('nx.json')).toEqual(false);
  });

  it('should not throw is cacheableOperations is an unexpected type', async () => {
    writeJson<NxJsonConfiguration>(tree, 'nx.json', {
      tasksRunnerOptions: {
        default: {
          runner: 'nx/tasks-runners/default',
          options: {
            cacheableOperations: 'invalid',
          },
        },
      },
    });

    await migrate(tree);

    const nxJson = readJson<NxJsonConfiguration>(tree, 'nx.json');
    expect(nxJson.tasksRunnerOptions).toMatchInlineSnapshot(`
      {
        "default": {
          "options": {
            "cacheableOperations": "invalid",
          },
        },
      }
    `);
  });
});
