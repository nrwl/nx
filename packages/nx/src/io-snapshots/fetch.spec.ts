import { fetchIoSnapshots } from './fetch';

const cloud = vi.hoisted(() => ({
  verifyOrUpdateNxCloudClient: vi.fn(),
  readIoSnapshots: vi.fn(),
}));

vi.mock('../nx-cloud/update-manager', () => ({
  verifyOrUpdateNxCloudClient: cloud.verifyOrUpdateNxCloudClient,
}));
vi.mock('../nx-cloud/resolution-helpers', () => ({
  findAncestorNodeModules: () => [],
}));

describe('fetchIoSnapshots', () => {
  const withClient = (client: object) =>
    cloud.verifyOrUpdateNxCloudClient.mockResolvedValue({
      nxCloudClient: { configureLightClientRequire: () => () => {}, ...client },
    });

  beforeEach(() => {
    vi.clearAllMocks();
    withClient({ readIoSnapshots: cloud.readIoSnapshots });
  });

  it('reads with the run options and returns what Nx Cloud sent', async () => {
    const result = { commits: ['head'], snapshots: {} };
    cloud.readIoSnapshots.mockResolvedValue(result);
    expect(await fetchIoSnapshots({ accessToken: 't' })).toBe(result);
    expect(cloud.readIoSnapshots).toHaveBeenCalledWith(
      expect.objectContaining({ nxCloudOptions: { accessToken: 't' } })
    );
  });

  it('passes the client error through with its code', async () => {
    const offline = Object.assign(new Error('getaddrinfo'), {
      code: 'ENOTFOUND',
    });
    cloud.readIoSnapshots.mockRejectedValue(offline);
    await expect(fetchIoSnapshots({})).rejects.toBe(offline);
  });

  it.each([
    [
      'no set',
      () => cloud.readIoSnapshots.mockResolvedValue(null),
      'INVALID_RESPONSE',
    ],
    [
      'a client that predates snapshots',
      () => withClient({}),
      'UNSUPPORTED_CLIENT',
    ],
    [
      'no client',
      () => cloud.verifyOrUpdateNxCloudClient.mockResolvedValue(null),
      'NO_CLOUD_CLIENT',
    ],
    [
      'a client that fails to load',
      () =>
        cloud.verifyOrUpdateNxCloudClient.mockRejectedValue(
          new Error('ENOSPC')
        ),
      'NO_CLOUD_CLIENT',
    ],
  ])('throws a coded error for %s', async (_, arrange, code) => {
    arrange();
    await expect(fetchIoSnapshots({})).rejects.toMatchObject({ code });
  });
});
