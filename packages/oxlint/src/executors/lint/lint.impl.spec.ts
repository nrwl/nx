import { ExecutorContext } from '@nx/devkit';
import * as childProcess from 'node:child_process';
import { oxlintExecutor } from './lint.impl.js';

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
    targetName: 'lint',
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

  it('returns success when the process exits with 0', async () => {
    spawnSyncMock.mockReturnValue({ status: 0 });

    const result = await oxlintExecutor(
      { lintFilePatterns: ['{projectRoot}'] },
      mockContext
    );

    expect(result).toEqual({ success: true });
    expect(spawnSyncMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.arrayContaining(['oxlint', 'libs/lib-a']),
      expect.objectContaining({ cwd: '/root' })
    );
  });

  it('returns failure when the process exits non-zero', async () => {
    spawnSyncMock.mockReturnValue({ status: 1 });

    const result = await oxlintExecutor(
      { lintFilePatterns: ['{projectRoot}'], quiet: true, maxWarnings: 0 },
      mockContext
    );

    expect(result).toEqual({ success: false });
  });

  it('falls back to the project root when lintFilePatterns is empty', async () => {
    spawnSyncMock.mockReturnValue({ status: 0 });

    await oxlintExecutor({ lintFilePatterns: [] }, mockContext);

    expect(spawnSyncMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.arrayContaining(['oxlint', 'libs/lib-a']),
      expect.any(Object)
    );
  });

  it('maps options to oxlint flags', async () => {
    spawnSyncMock.mockReturnValue({ status: 0 });

    await oxlintExecutor(
      {
        lintFilePatterns: ['{projectRoot}'],
        fix: true,
        maxWarnings: 5,
        typeAware: true,
        tsconfig: 'tsconfig.lib.json',
        disableNestedConfig: true,
      },
      mockContext
    );

    const args = spawnSyncMock.mock.calls[0][1];
    expect(args).toEqual(
      expect.arrayContaining([
        '--fix',
        '--max-warnings=5',
        '--tsconfig',
        'tsconfig.lib.json',
        '--type-aware',
        '--disable-nested-config',
      ])
    );
  });
});
