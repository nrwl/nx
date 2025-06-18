import { NxCloudCIMessageLifeCycle } from './nx-cloud-ci-message-life-cycle';
import { Task } from '../../config/task-graph';
import * as utils from '../../utils/is-ci';
import * as nxCloudUtils from '../../utils/nx-cloud-utils';
import * as nxJsonUtils from '../../config/nx-json';
import * as fileUtils from '../../utils/fileutils';
import * as workspaceRootUtils from '../../utils/workspace-root';
import { output } from '../../utils/output';
import { vol } from 'memfs';

jest.mock('fs');
jest.mock('../../utils/workspace-root');

describe('NxCloudCIMessageLifeCycle', () => {
  let lifecycle: NxCloudCIMessageLifeCycle;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    lifecycle = new NxCloudCIMessageLifeCycle();
    errorSpy = jest.spyOn(output, 'error').mockImplementation();
    jest.spyOn(output, 'addNewline').mockImplementation();
    vol.reset();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const createTask = (id: string): Task => ({
    id,
    target: { project: 'test', target: 'build' },
    projectRoot: 'libs/test',
    overrides: {},
    outputs: [],
    parallelism: true,
  });

  it('should not show warning when not in CI', async () => {
    jest.spyOn(utils, 'isCI').mockReturnValue(false);
    jest.spyOn(nxCloudUtils, 'isNxCloudUsed').mockReturnValue(false);
    jest.spyOn(nxJsonUtils, 'readNxJson').mockReturnValue({});

    vol.fromJSON({
      '/root/package.json': JSON.stringify({
        devDependencies: {
          nx: '21.0.0',
        },
      }),
    });

    (workspaceRootUtils as any).workspaceRoot = '/root';

    await lifecycle.startTasks([createTask('task1')], { groupId: 1 });

    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('should not show warning when no tasks', async () => {
    jest.spyOn(utils, 'isCI').mockReturnValue(true);

    await lifecycle.startTasks([], { groupId: 1 });

    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('should not show warning when nx-cloud is configured via token', async () => {
    jest.spyOn(utils, 'isCI').mockReturnValue(true);
    jest.spyOn(nxCloudUtils, 'isNxCloudUsed').mockReturnValue(true);

    await lifecycle.startTasks([createTask('task1')], { groupId: 1 });

    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('should show warning when nx-cloud is in package.json but not configured', async () => {
    jest.spyOn(utils, 'isCI').mockReturnValue(true);
    jest.spyOn(nxCloudUtils, 'isNxCloudUsed').mockReturnValue(false);
    jest.spyOn(nxJsonUtils, 'readNxJson').mockReturnValue({});

    vol.fromJSON({
      '/root/package.json': JSON.stringify({
        devDependencies: {
          'nx-cloud': '16.0.0',
        },
      }),
    });

    (workspaceRootUtils as any).workspaceRoot = '/root';

    await lifecycle.startTasks([createTask('task1')], { groupId: 1 });

    expect(errorSpy).toHaveBeenCalledWith({
      title: '',
      bodyLines: expect.arrayContaining([
        expect.stringContaining('https://cloud.nx.app/get-started'),
      ]),
    });
  });

  it('should show warning when @nrwl/nx-cloud is in package.json but not configured', async () => {
    jest.spyOn(utils, 'isCI').mockReturnValue(true);
    jest.spyOn(nxCloudUtils, 'isNxCloudUsed').mockReturnValue(false);
    jest.spyOn(nxJsonUtils, 'readNxJson').mockReturnValue({});

    vol.fromJSON({
      '/root/package.json': JSON.stringify({
        dependencies: {
          '@nrwl/nx-cloud': '15.0.0',
        },
      }),
    });

    (workspaceRootUtils as any).workspaceRoot = '/root';

    await lifecycle.startTasks([createTask('task1')], { groupId: 1 });

    expect(errorSpy).toHaveBeenCalledWith({
      title: '',
      bodyLines: expect.arrayContaining([
        expect.stringContaining('https://cloud.nx.app/get-started'),
      ]),
    });
  });

  it('should show warning when in CI without nx-cloud', async () => {
    jest.spyOn(utils, 'isCI').mockReturnValue(true);
    jest.spyOn(nxCloudUtils, 'isNxCloudUsed').mockReturnValue(false);
    jest.spyOn(nxJsonUtils, 'readNxJson').mockReturnValue({});

    vol.fromJSON({
      '/root/package.json': JSON.stringify({
        devDependencies: {
          nx: '21.0.0',
        },
      }),
    });

    (workspaceRootUtils as any).workspaceRoot = '/root';

    await lifecycle.startTasks([createTask('task1')], { groupId: 1 });

    expect(errorSpy).toHaveBeenCalledWith({
      title: '',
      bodyLines: expect.arrayContaining([
        expect.stringContaining('https://cloud.nx.app/get-started'),
      ]),
    });
  });

  it('should only check once per run', async () => {
    jest.spyOn(utils, 'isCI').mockReturnValue(true);
    jest.spyOn(nxCloudUtils, 'isNxCloudUsed').mockReturnValue(false);
    jest.spyOn(nxJsonUtils, 'readNxJson').mockReturnValue({});

    vol.fromJSON({
      '/root/package.json': JSON.stringify({
        devDependencies: {
          nx: '21.0.0',
        },
      }),
    });

    (workspaceRootUtils as any).workspaceRoot = '/root';

    // Call multiple times
    await lifecycle.startTasks([createTask('task1')], { groupId: 1 });
    await lifecycle.startTasks([createTask('task2')], { groupId: 1 });
    await lifecycle.startTasks([createTask('task3')], { groupId: 1 });

    // Should only show warning once
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });

  it('should handle missing package.json gracefully', async () => {
    jest.spyOn(utils, 'isCI').mockReturnValue(true);
    jest.spyOn(nxCloudUtils, 'isNxCloudUsed').mockReturnValue(false);
    jest.spyOn(nxJsonUtils, 'readNxJson').mockReturnValue({});

    // No package.json in the filesystem
    vol.fromJSON({});

    (workspaceRootUtils as any).workspaceRoot = '/root';

    await lifecycle.startTasks([createTask('task1')], { groupId: 1 });

    expect(errorSpy).toHaveBeenCalledWith({
      title: '',
      bodyLines: expect.any(Array),
    });
  });

  it('should not show warning when sharedFs configuration exists in nx.json', async () => {
    jest.spyOn(utils, 'isCI').mockReturnValue(true);
    jest.spyOn(nxCloudUtils, 'isNxCloudUsed').mockReturnValue(false);
    jest.spyOn(nxJsonUtils, 'readNxJson').mockReturnValue({
      sharedFs: {
        path: '/some/path',
      },
    } as any);

    vol.fromJSON({
      '/root/package.json': JSON.stringify({
        devDependencies: {
          nx: '21.0.0',
        },
      }),
    });

    (workspaceRootUtils as any).workspaceRoot = '/root';

    await lifecycle.startTasks([createTask('task1')], { groupId: 1 });

    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('should not show warning when custom task runner with cache is configured', async () => {
    jest.spyOn(utils, 'isCI').mockReturnValue(true);
    jest.spyOn(nxCloudUtils, 'isNxCloudUsed').mockReturnValue(false);
    jest.spyOn(nxJsonUtils, 'readNxJson').mockReturnValue({
      tasksRunnerOptions: {
        default: {
          runner: 'my-custom-cache-runner',
        },
      },
    } as any);

    vol.fromJSON({
      '/root/package.json': JSON.stringify({
        devDependencies: {
          nx: '21.0.0',
        },
      }),
    });

    (workspaceRootUtils as any).workspaceRoot = '/root';

    await lifecycle.startTasks([createTask('task1')], { groupId: 1 });

    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('should not show warning when s3 cache is configured in nx.json', async () => {
    jest.spyOn(utils, 'isCI').mockReturnValue(true);
    jest.spyOn(nxCloudUtils, 'isNxCloudUsed').mockReturnValue(false);
    jest.spyOn(nxJsonUtils, 'readNxJson').mockReturnValue({
      s3: {
        region: 'us-east-1',
        bucket: 'my-bucket',
      },
    } as any);

    vol.fromJSON({
      '/root/package.json': JSON.stringify({
        devDependencies: {
          nx: '21.0.0',
        },
      }),
    });

    (workspaceRootUtils as any).workspaceRoot = '/root';

    await lifecycle.startTasks([createTask('task1')], { groupId: 1 });

    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('should not show warning when gcs cache is configured in nx.json', async () => {
    jest.spyOn(utils, 'isCI').mockReturnValue(true);
    jest.spyOn(nxCloudUtils, 'isNxCloudUsed').mockReturnValue(false);
    jest.spyOn(nxJsonUtils, 'readNxJson').mockReturnValue({
      gcs: {
        bucket: 'my-bucket',
      },
    } as any);

    vol.fromJSON({
      '/root/package.json': JSON.stringify({
        devDependencies: {
          nx: '21.0.0',
        },
      }),
    });

    (workspaceRootUtils as any).workspaceRoot = '/root';

    await lifecycle.startTasks([createTask('task1')], { groupId: 1 });

    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('should not show warning when azure cache is configured in nx.json', async () => {
    jest.spyOn(utils, 'isCI').mockReturnValue(true);
    jest.spyOn(nxCloudUtils, 'isNxCloudUsed').mockReturnValue(false);
    jest.spyOn(nxJsonUtils, 'readNxJson').mockReturnValue({
      azure: {
        container: 'my-container',
        accountName: 'my-account',
      },
    } as any);

    vol.fromJSON({
      '/root/package.json': JSON.stringify({
        devDependencies: {
          nx: '21.0.0',
        },
      }),
    });

    (workspaceRootUtils as any).workspaceRoot = '/root';

    await lifecycle.startTasks([createTask('task1')], { groupId: 1 });

    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('should not show warning when NX_SELF_HOSTED_REMOTE_CACHE_SERVER is set', async () => {
    jest.spyOn(utils, 'isCI').mockReturnValue(true);
    jest.spyOn(nxCloudUtils, 'isNxCloudUsed').mockReturnValue(false);
    jest.spyOn(nxJsonUtils, 'readNxJson').mockReturnValue({});

    vol.fromJSON({
      '/root/package.json': JSON.stringify({
        devDependencies: {
          nx: '21.0.0',
        },
      }),
    });

    (workspaceRootUtils as any).workspaceRoot = '/root';

    const originalEnv = process.env.NX_SELF_HOSTED_REMOTE_CACHE_SERVER;
    process.env.NX_SELF_HOSTED_REMOTE_CACHE_SERVER = 'http://localhost:3000';

    await lifecycle.startTasks([createTask('task1')], { groupId: 1 });

    expect(errorSpy).not.toHaveBeenCalled();

    if (originalEnv !== undefined) {
      process.env.NX_SELF_HOSTED_REMOTE_CACHE_SERVER = originalEnv;
    } else {
      delete process.env.NX_SELF_HOSTED_REMOTE_CACHE_SERVER;
    }
  });
});
