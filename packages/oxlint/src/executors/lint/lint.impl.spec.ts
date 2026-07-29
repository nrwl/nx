import { ExecutorContext, output } from '@nx/devkit';
import * as childProcess from 'node:child_process';
import { oxlintExecutor } from './lint.impl.js';

jest.mock('node:child_process', () => ({
  ...jest.requireActual('node:child_process'),
  spawnSync: jest.fn(),
}));

/** Restores `process.platform` after a test overrides it. */
function withPlatform(platform: NodeJS.Platform, fn: () => Promise<void>) {
  const original = Object.getOwnPropertyDescriptor(process, 'platform');
  Object.defineProperty(process, 'platform', { value: platform });
  return fn().finally(() =>
    Object.defineProperty(process, 'platform', original)
  );
}

describe('@nx/oxlint:lint executor', () => {
  const spawnSyncMock = childProcess.spawnSync as jest.Mock;
  let outputErrorSpy: jest.SpyInstance;
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
    outputErrorSpy = jest.spyOn(output, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    outputErrorSpy.mockRestore();
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

  // Asserted as literals rather than by re-deriving `process.platform === 'win32'`,
  // which would mirror the implementation and pass however it changed.
  it('does not use a shell off Windows, which would re-expand the lint globs', async () => {
    spawnSyncMock.mockReturnValue({ status: 0 });

    await withPlatform('linux', async () => {
      await oxlintExecutor(
        { lintFilePatterns: ['{projectRoot}'] },
        mockContext
      );
    });

    expect(spawnSyncMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.anything(),
      expect.objectContaining({ shell: false })
    );
  });

  it('uses a shell on Windows, where the package manager is a `.cmd` shim', async () => {
    spawnSyncMock.mockReturnValue({ status: 0 });

    await withPlatform('win32', async () => {
      await oxlintExecutor(
        { lintFilePatterns: ['{projectRoot}'] },
        mockContext
      );
    });

    expect(spawnSyncMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.anything(),
      expect.objectContaining({ shell: true })
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

  // `{ success: false }` alone cannot distinguish these branches from an ordinary
  // lint failure — the fallthrough produces it too. The report is the behaviour.
  it('reports a failure to spawn rather than reading it as a lint failure', async () => {
    spawnSyncMock.mockReturnValue({
      status: null,
      error: Object.assign(new Error('spawn ENOENT'), { code: 'ENOENT' }),
    });

    const result = await oxlintExecutor(
      { lintFilePatterns: ['{projectRoot}'] },
      mockContext
    );

    expect(result).toEqual({ success: false });
    expect(outputErrorSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Could not run Oxlint for "lib-a"',
        bodyLines: expect.arrayContaining(['spawn ENOENT']),
      })
    );
  });

  it('reports a shell that could not find the command', async () => {
    // cmd.exe reports command-not-found as 9009; a POSIX shell would say 127.
    spawnSyncMock.mockReturnValue({ status: 9009 });

    await withPlatform('win32', async () => {
      const result = await oxlintExecutor(
        { lintFilePatterns: ['{projectRoot}'] },
        mockContext
      );
      expect(result).toEqual({ success: false });
    });

    expect(outputErrorSpy).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Could not run Oxlint for "lib-a"' })
    );
  });

  it('does not mistake an ordinary lint failure for a missing command', async () => {
    spawnSyncMock.mockReturnValue({ status: 1 });

    await withPlatform('win32', async () => {
      await oxlintExecutor(
        { lintFilePatterns: ['{projectRoot}'] },
        mockContext
      );
    });

    expect(outputErrorSpy).not.toHaveBeenCalled();
  });

  it('reports a termination signal', async () => {
    spawnSyncMock.mockReturnValue({ status: null, signal: 'SIGKILL' });

    const result = await oxlintExecutor(
      { lintFilePatterns: ['{projectRoot}'] },
      mockContext
    );

    expect(outputErrorSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        title: expect.stringContaining('SIGKILL'),
      })
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
