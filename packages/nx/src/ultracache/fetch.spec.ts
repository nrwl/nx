import { fetchUltracacheConfigurations } from './fetch';

const cloud = vi.hoisted(() => ({
  verifyOrUpdateNxCloudClient: vi.fn(),
  readUltracacheConfigurations: vi.fn(),
}));

vi.mock('../nx-cloud/update-manager', () => ({
  verifyOrUpdateNxCloudClient: cloud.verifyOrUpdateNxCloudClient,
}));
vi.mock('../nx-cloud/resolution-helpers', () => ({
  findAncestorNodeModules: () => [],
}));

describe('fetchUltracacheConfigurations', () => {
  const withClient = (client: object) =>
    cloud.verifyOrUpdateNxCloudClient.mockResolvedValue({
      nxCloudClient: { configureLightClientRequire: () => () => {}, ...client },
    });

  beforeEach(() => {
    vi.clearAllMocks();
    withClient({
      readUltracacheConfigurations: cloud.readUltracacheConfigurations,
    });
  });

  it('reads with the run options and returns what Nx Cloud sent', async () => {
    const result = { configurations: {} };
    cloud.readUltracacheConfigurations.mockResolvedValue(result);
    expect(await fetchUltracacheConfigurations({ accessToken: 't' })).toBe(
      result
    );
    expect(cloud.readUltracacheConfigurations).toHaveBeenCalledWith(
      expect.objectContaining({ nxCloudOptions: { accessToken: 't' } })
    );
  });

  it('prefers immutable files and preserves errors and empty results from that hook', async () => {
    const files = {
      commits: ['head'],
      updatedAt: 42,
      manifestPath: '/m',
      filesDirectory: '/f',
    };
    const readFiles = vi
      .fn()
      .mockResolvedValueOnce(files)
      .mockResolvedValueOnce(null);
    withClient({
      readUltracacheConfigurationFiles: readFiles,
      readUltracacheConfigurations: cloud.readUltracacheConfigurations,
    });
    await expect(
      fetchUltracacheConfigurations({ accessToken: 't' })
    ).resolves.toEqual({ files });
    expect(readFiles).toHaveBeenCalledWith({
      nxCloudOptions: { accessToken: 't' },
      workspaceRoot: expect.any(String),
      timeoutMs: 10_000,
    });
    await expect(fetchUltracacheConfigurations({})).rejects.toMatchObject({
      code: 'NO_CONFIGURATIONS',
    });
    const error = Object.assign(new Error('corrupt'), {
      code: 'INVALID_RESPONSE',
    });
    readFiles.mockRejectedValueOnce(error);
    await expect(fetchUltracacheConfigurations({})).rejects.toBe(error);
    expect(cloud.readUltracacheConfigurations).not.toHaveBeenCalled();
  });

  it('passes the client error through with its code', async () => {
    const offline = Object.assign(new Error('getaddrinfo'), {
      code: 'ENOTFOUND',
    });
    cloud.readUltracacheConfigurations.mockRejectedValue(offline);
    await expect(fetchUltracacheConfigurations({})).rejects.toBe(offline);
  });

  it.each([
    [
      'no set',
      () => cloud.readUltracacheConfigurations.mockResolvedValue(null),
      'NO_CONFIGURATIONS',
    ],
    [
      'a client that predates Ultracache',
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
    await expect(fetchUltracacheConfigurations({})).rejects.toMatchObject({
      code,
    });
  });
});
