import type { Mock } from 'vitest';
import { TempFs } from '../../internal-testing-utils/temp-fs';
import { withEnvironmentVariables } from '../../internal-testing-utils/with-environment';
import {
  createNxCloudOnboardingURL,
  getURLifShortenFailed,
} from './url-shorten';

vi.mock('../../utils/http-client', () => ({
  httpRequest: vi.fn(),
}));
vi.mock('../../utils/git-utils', () => ({
  getVcsRemoteInfo: vi.fn(() => ({ domain: 'gitlab.com', slug: 'org/repo' })),
}));

const httpRequestMock = (await import('../../utils/http-client'))
  .httpRequest as Mock;

describe('URL shorten various functions', () => {
  describe('createNxCloudOnboardingURL', () => {
    let fs: TempFs;

    beforeEach(() => {
      fs = new TempFs('url-shorten');
      httpRequestMock.mockReset();
      httpRequestMock.mockResolvedValue({ data: 'short-id' });
    });

    afterEach(() => {
      fs.cleanup();
    });

    test('should only contact the nxCloudUrl configured in the given directory', async () => {
      fs.createFileSync('nx.json', JSON.stringify({}));
      fs.createFileSync(
        'other/nx.json',
        JSON.stringify({ nxCloudUrl: 'https://nx-cloud.acme.example' })
      );

      const url = await withEnvironmentVariables(
        { NX_CLOUD_API: undefined, NRWL_API: undefined },
        () =>
          createNxCloudOnboardingURL(
            'nx-connect',
            'access-token',
            undefined,
            true,
            false,
            `${fs.tempDir}/other`
          )
      );

      expect(url).toBe('https://nx-cloud.acme.example/connect/short-id');
      expect(httpRequestMock.mock.calls.map(([url]) => url)).toEqual([
        'https://nx-cloud.acme.example/nx-cloud/system/features',
        'https://nx-cloud.acme.example/nx-cloud/onboarding',
      ]);
    });

    test('should not put the access token in the fallback URL when shortening fails', async () => {
      fs.createFileSync(
        'nx.json',
        JSON.stringify({ nxCloudUrl: 'https://cloud.example.com' })
      );
      httpRequestMock.mockRejectedValue(new Error('503'));

      const result = await withEnvironmentVariables(
        { NX_CLOUD_API: undefined, NRWL_API: undefined },
        () =>
          createNxCloudOnboardingURL(
            'nx-connect',
            'secret-workspace-token',
            undefined,
            false,
            false,
            fs.tempDir
          )
      );

      expect(result).toBe(
        'https://cloud.example.com/setup/connect-workspace/manual?source=nx-connect'
      );
    });
  });

  describe('getURLifShortenFailed', () => {
    const apiUrl = 'https://example.com';
    const source = 'source-test';

    test('should return GitHub URL with slug when usesGithub is true and githubSlug is provided', () => {
      const usesGithub = true;
      const githubSlug = 'user/repo';

      const result = getURLifShortenFailed(
        usesGithub,
        githubSlug,
        apiUrl,
        source
      );

      expect(result).toBe(
        `${apiUrl}/setup/connect-workspace/github/connect?name=${encodeURIComponent(
          githubSlug
        )}&source=${source}`
      );
    });

    test('should return GitHub select URL when usesGithub is true and githubSlug is not provided', () => {
      const usesGithub = true;
      const githubSlug = null;

      const result = getURLifShortenFailed(
        usesGithub,
        githubSlug,
        apiUrl,
        source
      );

      expect(result).toBe(
        `${apiUrl}/setup/connect-workspace/github/select?source=${source}`
      );
    });

    test('should return manual URL when usesGithub is false', () => {
      const usesGithub = false;
      const githubSlug = 'user/repo';

      const result = getURLifShortenFailed(
        usesGithub,
        githubSlug,
        apiUrl,
        source
      );

      expect(result).toBe(
        `${apiUrl}/setup/connect-workspace/manual?source=${source}`
      );
    });
  });
});
