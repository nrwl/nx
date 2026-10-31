import type { Mock } from 'vitest';
import { TempFs } from '../../internal-testing-utils/temp-fs';
import { withEnvironmentVariables } from '../../internal-testing-utils/with-environment';
import { isWorkspaceClaimed } from './is-workspace-claimed';

vi.mock('../../utils/http-client', () => ({
  httpRequest: vi.fn(),
}));

const httpRequestMock = (await import('../../utils/http-client'))
  .httpRequest as Mock;

describe('isWorkspaceClaimed', () => {
  let fs: TempFs;

  beforeEach(() => {
    fs = new TempFs('is-workspace-claimed');
    httpRequestMock.mockReset();
    httpRequestMock.mockResolvedValue({ data: true });
  });

  afterEach(() => {
    fs.cleanup();
  });

  it('should ask the nxCloudUrl configured in nx.json', async () => {
    fs.createFileSync(
      'nx.json',
      JSON.stringify({ nxCloudUrl: 'https://nx-cloud.acme.example' })
    );

    await withEnvironmentVariables(
      { NX_CLOUD_API: undefined, NRWL_API: undefined },
      () => isWorkspaceClaimed('access-token')
    );

    expect(httpRequestMock.mock.calls.map(([url]) => url)).toEqual([
      'https://nx-cloud.acme.example/nx-cloud/is-workspace-claimed',
    ]);
  });

  it('should return false when nx.json cannot be read', async () => {
    fs.createFileSync('nx.json', '{');

    await expect(
      withEnvironmentVariables(
        { NX_CLOUD_API: undefined, NRWL_API: undefined },
        () => isWorkspaceClaimed('access-token')
      )
    ).resolves.toBe(false);
    expect(httpRequestMock).not.toHaveBeenCalled();
  });
});
