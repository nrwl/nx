const verifyOrUpdateNxCloudClient = vi.fn();

vi.mock('../update-manager', () => ({
  verifyOrUpdateNxCloudClient: (...args: unknown[]) =>
    verifyOrUpdateNxCloudClient(...args),
}));
vi.mock('../resolution-helpers', () => ({
  findAncestorNodeModules: () => [],
}));

import { getCloudClient } from './client';

function bundle(exports: Record<string, unknown> = {}) {
  return {
    configureLightClientRequire: () => () => {},
    commands: { login: vi.fn(async () => {}) },
    ...exports,
  };
}

describe('getCloudClient', () => {
  it('passes the command line to bundles that export runCLI', async () => {
    const runCLI = vi.fn(async () => 3);
    verifyOrUpdateNxCloudClient.mockResolvedValue({
      nxCloudClient: bundle({ runCLI }),
    });

    const client = await getCloudClient({});

    expect(await client.runCLI!(['--help'])).toBe(3);
    expect(runCLI).toHaveBeenCalledWith(['--help']);
  });

  it('leaves runCLI undefined for bundles that only export commands', async () => {
    verifyOrUpdateNxCloudClient.mockResolvedValue({ nxCloudClient: bundle() });

    const client = await getCloudClient({});

    expect(client.runCLI).toBeUndefined();
    expect(client.availableCommands).toEqual(['login']);
  });
});
