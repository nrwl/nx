import { ExecutorContext } from '@nx/devkit';
import buildExecutor from './build.impl';
import { computeContainerMetadata } from '../../metadata/compute-metadata';
import { createEngine } from './engines/engine-factory';
import { execCommand } from './lib/exec-command';
import { writeExecutorOutput } from './lib/outputs';
import {
  cleanupTempWorkspace,
  createTempWorkspace,
} from './lib/temp-workspace';

jest.mock('./engines/engine-factory');
jest.mock('./lib/exec-command');
jest.mock('./lib/outputs');
jest.mock('./lib/temp-workspace');
jest.mock('../../metadata/compute-metadata');

const mockedCreateEngine = createEngine as jest.Mock;
const mockedExecCommand = execCommand as jest.Mock;
const mockedWriteOutput = writeExecutorOutput as jest.Mock;
const mockedCreateTempWorkspace = createTempWorkspace as jest.Mock;
const mockedCleanupTempWorkspace = cleanupTempWorkspace as jest.Mock;
const mockedComputeMetadata = computeContainerMetadata as jest.Mock;

function fakeContext(): ExecutorContext {
  return {
    root: '/workspace',
    cwd: '/workspace',
    isVerbose: false,
    projectName: 'app',
    projectGraph: {
      nodes: { app: { name: 'app', type: 'app', data: { root: 'apps/app' } } },
      dependencies: {},
    },
  } as unknown as ExecutorContext;
}

function fakeEngine(overrides: Partial<Record<string, jest.Mock>> = {}) {
  return {
    name: 'docker',
    initialize: jest.fn().mockResolvedValue({ version: '0.12.1' }),
    finalize: jest.fn().mockResolvedValue(undefined),
    buildArgs: jest
      .fn()
      .mockResolvedValue(['build', '--tag', 'app:latest', '.']),
    getCommand: jest
      .fn()
      .mockReturnValue({
        command: 'docker',
        args: ['buildx', 'build', '--tag', 'app:latest', '.'],
      }),
    getImageId: jest.fn().mockReturnValue(undefined),
    getMetadata: jest.fn().mockReturnValue(undefined),
    getDigest: jest.fn().mockReturnValue(undefined),
    ...overrides,
  };
}

describe('buildExecutor', () => {
  beforeEach(() => {
    mockedCreateTempWorkspace.mockReturnValue('/tmp/nx-docker-build-xyz');
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('runs initialize -> buildArgs -> exec -> finalize and returns success', async () => {
    const engine = fakeEngine();
    mockedCreateEngine.mockReturnValue(engine);
    mockedExecCommand.mockResolvedValue({
      stdout: '',
      stderr: '',
      exitCode: 0,
    });

    const result = await buildExecutor({ tags: ['app:latest'] }, fakeContext());

    expect(result).toEqual({ success: true });
    expect(engine.initialize).toHaveBeenCalled();
    expect(engine.buildArgs).toHaveBeenCalled();
    expect(mockedExecCommand).toHaveBeenCalledWith(
      'docker',
      ['buildx', 'build', '--tag', 'app:latest', '.'],
      expect.objectContaining({ cwd: '/workspace' })
    );
    expect(engine.finalize).toHaveBeenCalled();
  });

  it('throws when the build command exits non-zero, and skips finalize', async () => {
    const engine = fakeEngine();
    mockedCreateEngine.mockReturnValue(engine);
    mockedExecCommand.mockResolvedValue({
      stdout: '',
      stderr: 'boom',
      exitCode: 1,
    });

    await expect(buildExecutor({}, fakeContext())).rejects.toThrow(
      /build failed with: boom/
    );
    expect(engine.finalize).not.toHaveBeenCalled();
  });

  it('always cleans up the temp workspace, even on failure', async () => {
    const engine = fakeEngine();
    mockedCreateEngine.mockReturnValue(engine);
    mockedExecCommand.mockResolvedValue({
      stdout: '',
      stderr: 'boom',
      exitCode: 1,
    });

    await expect(buildExecutor({}, fakeContext())).rejects.toThrow();
    expect(mockedCleanupTempWorkspace).toHaveBeenCalledWith(
      '/tmp/nx-docker-build-xyz'
    );
  });

  it('computes metadata tags/labels and merges them into the build inputs before buildArgs', async () => {
    const engine = fakeEngine();
    mockedCreateEngine.mockReturnValue(engine);
    mockedExecCommand.mockResolvedValue({
      stdout: '',
      stderr: '',
      exitCode: 0,
    });
    mockedComputeMetadata.mockReturnValue({
      version: { main: 'main', partial: [], latest: false },
      tags: ['app:main'],
      labels: ['org.opencontainers.image.title=app'],
      annotations: [],
    });

    await buildExecutor({ metadata: { images: ['app'] } }, fakeContext());

    expect(mockedComputeMetadata).toHaveBeenCalledWith(
      expect.objectContaining({
        projectRoot: 'apps/app',
        workspaceRoot: '/workspace',
      })
    );
    const inputsArg = engine.buildArgs.mock.calls[0][0];
    expect(inputsArg.tags).toEqual(['app:main']);
    expect(inputsArg.labels).toEqual(['org.opencontainers.image.title=app']);
  });

  it('writes imageid/digest/metadata outputs when the engine reports them', async () => {
    const engine = fakeEngine({
      getImageId: jest.fn().mockReturnValue('sha256:abc'),
      getMetadata: jest
        .fn()
        .mockReturnValue('{"containerimage.digest":"sha256:xyz"}'),
      getDigest: jest.fn().mockReturnValue('sha256:xyz'),
    });
    mockedCreateEngine.mockReturnValue(engine);
    mockedExecCommand.mockResolvedValue({
      stdout: '',
      stderr: '',
      exitCode: 0,
    });

    await buildExecutor({}, fakeContext());

    expect(mockedWriteOutput).toHaveBeenCalledWith(
      'app',
      'imageid',
      'sha256:abc'
    );
    expect(mockedWriteOutput).toHaveBeenCalledWith(
      'app',
      'digest',
      'sha256:xyz'
    );
    expect(mockedWriteOutput).toHaveBeenCalledWith(
      'app',
      'metadata',
      '{"containerimage.digest":"sha256:xyz"}'
    );
  });

  it('writes no outputs when the engine reports nothing', async () => {
    const engine = fakeEngine();
    mockedCreateEngine.mockReturnValue(engine);
    mockedExecCommand.mockResolvedValue({
      stdout: '',
      stderr: '',
      exitCode: 0,
    });

    await buildExecutor({}, fakeContext());

    expect(mockedWriteOutput).not.toHaveBeenCalled();
  });
});
