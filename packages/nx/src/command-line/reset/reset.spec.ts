const invoke = vi.fn();
const getCloudClient = vi.fn();
const rmSync = vi.fn();

vi.mock('node:fs', () => ({ rmSync: (...args: unknown[]) => rmSync(...args) }));
vi.mock('../../nx-cloud/utilities/client', () => ({
  getCloudClient: (...args: unknown[]) => getCloudClient(...args),
}));
vi.mock('../../nx-cloud/utilities/get-cloud-options', () => ({
  getCloudOptions: () => ({}),
}));
vi.mock('../../nx-cloud/update-manager', () => ({
  getBundleInstallDefaultLocation: () => '/cache/cloud',
  // vi.mock is hoisted over the file's own declarations, so a class declared
  // up there is still uninitialized when this factory runs.
  NxCloudClientUnavailableError: class NxCloudClientUnavailableError extends Error {},
}));
vi.mock('../../utils/nx-cloud-utils', () => ({ isNxCloudUsed: () => true }));
vi.mock('../../config/configuration', () => ({ readNxJson: () => ({}) }));
vi.mock('../../daemon/client/client', () => ({
  daemonClient: { enabled: () => false },
}));
vi.mock('../../daemon/tmp-dir', () => ({
  DAEMON_DIR_FOR_CURRENT_WORKSPACE: '/ws/.nx/workspace-data/d',
}));
vi.mock('../../native/native-file-cache-location', () => ({
  getNativeFileCacheLocationToDelete: () => null,
}));
vi.mock('../../utils/package-manager', () => ({
  removeStaleTempInstallDirectories: () => {},
}));
vi.mock('../../utils/workspace-root', () => ({ workspaceRoot: '/ws' }));
vi.mock('../../utils/cache-directory', () => ({
  cacheDir: '/cache',
  workspaceDataDirectory: '/ws/.nx/workspace-data',
  cacheDirectoryForWorkspace: () => '/cache',
  sharedDataDirectory: () => '/ws/.nx/workspace-data',
}));

import { output } from '../../utils/output';
import { globalSpinner } from '../../utils/spinner';
import { NxCloudClientUnavailableError } from '../../nx-cloud/update-manager';
import { resetHandler } from './reset';

describe('nx reset', () => {
  let exit: ReturnType<typeof vi.spyOn>;
  let error: ReturnType<typeof vi.spyOn>;
  let success: ReturnType<typeof vi.spyOn>;
  let stepSucceeded: ReturnType<typeof vi.spyOn>;
  let stepFailed: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    invoke.mockReset();
    rmSync.mockReset();
    getCloudClient.mockReset();
    getCloudClient.mockResolvedValue({
      invoke,
      availableCommands: ['cleanup'],
    });
    exit = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('exited');
    }) as never);
    error = vi.spyOn(output, 'error').mockImplementation(() => {});
    success = vi.spyOn(output, 'success').mockImplementation(() => {});
    vi.spyOn(globalSpinner, 'start').mockReturnValue(globalSpinner);
    stepSucceeded = vi
      .spyOn(globalSpinner, 'succeed')
      .mockImplementation(() => {});
    stepFailed = vi.spyOn(globalSpinner, 'fail').mockImplementation(() => {});
  });

  afterEach(() => vi.restoreAllMocks());

  it('reports a successful reset after the Nx Cloud cleanup, without exiting early', async () => {
    invoke.mockResolvedValue(undefined);

    await resetHandler({});

    expect(invoke).toHaveBeenCalledWith('cleanup', false);
    expect(success).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Successfully reset the Nx workspace.' })
    );
    expect(exit).not.toHaveBeenCalled();
  });

  it('marks each finished step as a success', async () => {
    invoke.mockResolvedValue(undefined);

    await resetHandler({});

    expect(stepSucceeded.mock.calls.map(([text]) => text)).toEqual([
      'Stopped the Nx Daemon',
      'Removed the Nx Daemon workspace data',
      'Removed the cache directory',
      'Removed the workspace data directory',
      'Removed stale temporary package installs',
      'Cleaned up the Nx Cloud client',
      'Removed the installed Nx Cloud client',
    ]);
    expect(stepFailed).not.toHaveBeenCalled();
  });

  it('only runs the steps an --only flag asks for', async () => {
    await resetHandler({ onlyCache: true });

    expect(stepSucceeded.mock.calls.map(([text]) => text)).toEqual([
      'Removed the cache directory',
    ]);
  });

  it('records a failed Nx Cloud cleanup, still removes the installed client and exits 1', async () => {
    invoke.mockRejectedValue(new Error('marker file is in use'));

    await expect(resetHandler({})).rejects.toThrow('exited');

    expect(rmSync).toHaveBeenCalledWith('/cache/cloud', {
      recursive: true,
      force: true,
    });
    expect(error).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Failed to reset the Nx workspace.',
        bodyLines: expect.arrayContaining([
          'Failed to clean up the Nx Cloud client.',
          'Error: marker file is in use',
        ]),
      })
    );
    expect(stepFailed).toHaveBeenCalledWith(
      'Failed to clean up the Nx Cloud client.'
    );
    expect(stepSucceeded).toHaveBeenCalledWith(
      'Removed the installed Nx Cloud client'
    );
    expect(success).not.toHaveBeenCalled();
    expect(exit).toHaveBeenCalledWith(1);
  });

  it('resets successfully when no Nx Cloud client can be loaded', async () => {
    // A damaged bundle with no network to replace it from. Removing the
    // install is the step that matters, so reset should not exit 1 here.
    getCloudClient.mockRejectedValue(new NxCloudClientUnavailableError());

    await resetHandler({});

    expect(invoke).not.toHaveBeenCalled();
    expect(rmSync).toHaveBeenCalledWith('/cache/cloud', {
      recursive: true,
      force: true,
    });
    expect(stepFailed).not.toHaveBeenCalled();
    expect(exit).not.toHaveBeenCalled();
  });

  it('skips the cleanup command on a client that does not export it', async () => {
    getCloudClient.mockResolvedValue({ invoke, availableCommands: ['start'] });

    await resetHandler({});

    expect(invoke).not.toHaveBeenCalled();
    expect(stepSucceeded).toHaveBeenCalledWith(
      'Cleaned up the Nx Cloud client'
    );
    expect(exit).not.toHaveBeenCalled();
  });

  it('still fails the reset when loading the client fails for another reason', async () => {
    getCloudClient.mockRejectedValue(new Error('workspace is not configured'));

    await expect(resetHandler({})).rejects.toThrow('exited');

    expect(stepFailed).toHaveBeenCalledWith(
      'Failed to clean up the Nx Cloud client.'
    );
    expect(exit).toHaveBeenCalledWith(1);
  });
});
