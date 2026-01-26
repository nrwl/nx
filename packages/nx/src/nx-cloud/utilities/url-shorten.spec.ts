import { getURLifShortenFailed } from './url-shorten';

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
});
