import { ExecutorContext } from '@nx/devkit';
import { oxlintExecutor } from './lint.impl';
import * as childProcess from 'node:child_process';

jest.mock('node:child_process', () => ({
  ...jest.requireActual('node:child_process'),
  spawnSync: jest.fn(),
}));

describe('@nx/oxlint:lint executor', () => {
  const spawnSyncMock = childProcess.spawnSync as jest.Mock;
  const mockContext: ExecutorContext = {
    root: '/root',
    cwd: '/root',
    projectName: 'lib-a',
    targetName: 'oxlint',
    configurationName: undefined,
    isVerbose: false,
    projectsConfigurations: {
      version: 2,
      projects: {
        'lib-a': {
          root: 'libs/lib-a',
          targets: {},
        },
      },
    },
  } as unknown as ExecutorContext;

  beforeEach(() => {
    spawnSyncMock.mockReset();
  });

  it('returns success when process exits with 0', async () => {
    spawnSyncMock.mockReturnValue({ status: 0 });
    const result = await oxlintExecutor(
      {
        lintFilePatterns: ['{projectRoot}'],
      },
      mockContext
    );

    expect(result).toEqual({ success: true });
  });

  it('returns failure when process exits non-zero', async () => {
    spawnSyncMock.mockReturnValue({ status: 1 });
    const result = await oxlintExecutor(
      {
        lintFilePatterns: ['{projectRoot}'],
        quiet: true,
        maxWarnings: 0,
      },
      mockContext
    );

    expect(result).toEqual({ success: false });
  });
});
