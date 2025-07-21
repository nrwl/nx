import { getGithubSlugOrNull } from '../../utils/git-utils';
import { getURLifShortenFailed, repoUsesGithub } from './url-shorten';
import { getCloudUrl } from './get-cloud-options';

jest.mock('axios', () => ({
  get: jest.fn(),
}));

jest.mock('../../utils/git-utils', () => ({
  getGithubSlugOrNull: jest.fn(),
}));

jest.mock('./get-cloud-options', () => ({
  getCloudUrl: jest.fn(),
}));

describe('URL shorten various functions', () => {
  describe('getURLifShortenFailed', () => {
    const apiUrl = 'https://example.com';
    const source = 'source-test';
    const accessToken = 'access-token';

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
        source,
        accessToken
      );

      expect(result).toBe(
        `${apiUrl}/setup/connect-workspace/manual?accessToken=${accessToken}&source=${source}`
      );
    });

    test('should return manual URL when usesGithub is false and accessToken is not provided', () => {
      const usesGithub = false;
      const githubSlug = null;

      const result = getURLifShortenFailed(
        usesGithub,
        githubSlug,
        apiUrl,
        source
      );

      expect(result).toBe(
        `${apiUrl}/setup/connect-workspace/manual?accessToken=undefined&source=${source}`
      );
    });
  });

  describe('repoUsesGithub', () => {
    const axios = require('axios');
    beforeEach(() => {
      jest.resetAllMocks();
    });

    it('should return true when githubSlug is provided and apiUrl includes cloud.nx.app', async () => {
      (getGithubSlugOrNull as jest.Mock).mockReturnValue('user/repo');
      (getCloudUrl as jest.Mock).mockReturnValue('https://cloud.nx.app');
      axios.get.mockResolvedValue({
        data: { isGithubIntegrationEnabled: false },
      });
      const result = await repoUsesGithub(
        false,
        'user/repo',
        'https://cloud.nx.app'
      );

      expect(result).toBe(true);
    });

    it('should return true when github is true and installation supports GitHub', async () => {
      (getGithubSlugOrNull as jest.Mock).mockReturnValue(null);
      (getCloudUrl as jest.Mock).mockReturnValue('https://api.other.app');
      axios.get.mockResolvedValue({
        data: { isGithubIntegrationEnabled: true },
      });
      const result = await repoUsesGithub(
        true,
        undefined,
        'https://api.other.app'
      );

      expect(result).toBe(true);
    });

    it('should return false when githubSlug and github are not provided and installation does not support GitHub', async () => {
      (getGithubSlugOrNull as jest.Mock).mockReturnValue(null);
      (getCloudUrl as jest.Mock).mockReturnValue('https://api.other.app');
      axios.get.mockResolvedValue({
        data: { isGithubIntegrationEnabled: false },
      });
      const result = await repoUsesGithub();
      expect(result).toBe(false);
    });

    it('should return true when githubSlug is not provided but github is true and apiUrl includes eu.nx.app', async () => {
      (getGithubSlugOrNull as jest.Mock).mockReturnValue(null);
      (getCloudUrl as jest.Mock).mockReturnValue('https://eu.nx.app');
      axios.get.mockResolvedValue({
        data: { isGithubIntegrationEnabled: false },
      });
      const result = await repoUsesGithub(true, undefined, 'https://eu.nx.app');

      expect(result).toBe(true);
    });

    it('should return true when apiUrl is not provided but githubSlug is provided and installation supports GitHub', async () => {
      (getGithubSlugOrNull as jest.Mock).mockReturnValue('user/repo');
      (getCloudUrl as jest.Mock).mockReturnValue('https://api.other.app');
      axios.get.mockResolvedValue({
        data: { isGithubIntegrationEnabled: true },
      });
      const result = await repoUsesGithub(false, 'user/repo');

      expect(result).toBe(true);
      expect(getCloudUrl).toHaveBeenCalled();
    });
  });
});
