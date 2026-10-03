const invoke = vi.fn();
const rmSync = vi.fn();

vi.mock('node:fs', () => ({ rmSync: (...args: unknown[]) => rmSync(...args) }));
vi.mock('../../nx-cloud/utilities/client', () => ({
  getCloudClient: vi.fn(async () => ({ invoke })),
}));
vi.mock('../../nx-cloud/utilities/get-cloud-options', () => ({
  getCloudOptions: () => ({}),
}));
vi.mock('../../nx-cloud/update-manager', () => ({
  getBundleInstallDefaultLocation: () => '/cache/cloud',
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
vi.mock('../../utils/workspace-root', () => ({ workspaceRoot: '/ws' }));
vi.mock('../../utils/cache-directory', () => ({
  cacheDir: '/cache',
  workspaceDataDirectory: '/ws/.nx/workspace-data',
  cacheDirectoryForWorkspace: () => '/cache',
  sharedDataDirectory: () => '/ws/.nx/workspace-data',
}));

import { output } from '../../utils/output';
import { resetHandler } from './reset';

describe('nx reset', () => {
  let exit: ReturnType<typeof vi.spyOn>;
  let error: ReturnType<typeof vi.spyOn>;
  let success: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    invoke.mockReset();
    rmSync.mockReset();
    exit = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('exited');
    }) as never);
    error = vi.spyOn(output, 'error').mockImplementation(() => {});
    success = vi.spyOn(output, 'success').mockImplementation(() => {});
    vi.spyOn(output, 'note').mockImplementation(() => {});
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
    expect(success).not.toHaveBeenCalled();
    expect(exit).toHaveBeenCalledWith(1);
  });
});
