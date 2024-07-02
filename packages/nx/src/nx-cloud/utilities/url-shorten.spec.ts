import {
  removeVersionModifier,
  compareCleanCloudVersions,
  getNxCloudVersion,
  versionIsValid,
} from './url-shorten';

jest.mock('axios', () => ({
  get: jest.fn(),
}));

describe('URL shorten various functions', () => {
  describe('compareCleanCloudVersions', () => {
    it('should return 1 if the first version is newer', () => {
      expect(compareCleanCloudVersions('2407.01.100', '2312.25.50')).toBe(1);
      expect(compareCleanCloudVersions('2402.01.20', '2401.31.300')).toBe(1);
      expect(compareCleanCloudVersions('2401.01.20', '2312.31.300')).toBe(1);
      expect(compareCleanCloudVersions('2312.26.05', '2312.25.100')).toBe(1);
      expect(compareCleanCloudVersions('2312.25.100', '2311.25.90')).toBe(1);
      expect(compareCleanCloudVersions('2312.25.120', '2312.24.110')).toBe(1);
    });

    it('should return -1 if the first version is older', () => {
      expect(compareCleanCloudVersions('2312.25.50', '2407.01.100')).toBe(-1);
      expect(compareCleanCloudVersions('2312.31.100', '2401.01.100')).toBe(-1);
      expect(compareCleanCloudVersions('2312.25.100', '2312.26.50')).toBe(-1);
      expect(compareCleanCloudVersions('2311.25.90', '2312.25.80')).toBe(-1);
      expect(compareCleanCloudVersions('2312.24.110', '2312.25.100')).toBe(-1);
    });

    it('should return 0 if both versions are the same', () => {
      expect(compareCleanCloudVersions('2312.25.50', '2312.25.50')).toBe(0);
      expect(compareCleanCloudVersions('2407.01.100', '2407.01.100')).toBe(0);
    });
  });

  describe('removeVersionModifier', () => {
    it('should return the version without the modifier', () => {
      expect(removeVersionModifier('2406.13.5.hotfix2')).toBe('2406.13.5');
      expect(removeVersionModifier('2024.07.01.beta')).toBe('2024.07.01');
      expect(removeVersionModifier('2023.12.25.alpha1')).toBe('2023.12.25');
    });

    it('should return the original version if there is no modifier', () => {
      expect(removeVersionModifier('2406.13.5')).toBe('2406.13.5');
      expect(removeVersionModifier('2024.07.01')).toBe('2024.07.01');
      expect(removeVersionModifier('2023.12.25')).toBe('2023.12.25');
    });

    it('should handle versions with multiple dots and hyphens correctly', () => {
      expect(removeVersionModifier('2406-13-5-hotfix2')).toBe('2406.13.5');
      expect(removeVersionModifier('2024.07.01-patch')).toBe('2024.07.01');
      expect(removeVersionModifier('2023.12.25.alpha-1')).toBe('2023.12.25');
    });
  });

  describe('getNxCloudVersion', () => {
    const axios = require('axios');
    const apiUrl = 'https://cloud.nx.app';

    it('should return the version if the response is successful', async () => {
      const mockVersion = '2406.13.5.hotfix2';
      axios.get.mockResolvedValue({
        data: { version: mockVersion },
      });

      const version = await getNxCloudVersion(apiUrl);
      expect(version).toBe('2406.13.5');
      expect(axios.get).toHaveBeenCalledWith(
        `${apiUrl}/nx-cloud/system/version`
      );
    });

    it('should return null if the request fails', async () => {
      const mockError = new Error('Request failed');
      axios.get.mockRejectedValue(mockError);
      const version = await getNxCloudVersion(apiUrl);
      expect(version).toBeNull();
    });
  });

  describe('versionIsValid', () => {
    it('should return true for valid versions with build numbers', () => {
      expect(versionIsValid('2407.01.100')).toBe(true);
      expect(versionIsValid('2312.25.50')).toBe(true);
    });

    it('should return false for versions without build numbers', () => {
      expect(versionIsValid('2407.01')).toBe(false); // Missing build number
      expect(versionIsValid('2312.25')).toBe(false); // Missing build number
    });

    it('should return false for invalid versions', () => {
      expect(versionIsValid('240701.100')).toBe(false); // No periods separating parts
      expect(versionIsValid('2312.250.50')).toBe(false); // Day part has three digits
      expect(versionIsValid('2401.1.100')).toBe(false); // Day part has one digit
      expect(versionIsValid('23.12.26')).toBe(false); // YearMonth part has two digits
      expect(versionIsValid('2312.26.')).toBe(false); // Extra period at the end
      expect(versionIsValid('.2312.26.100')).toBe(false); // Extra period at the beginning
      expect(versionIsValid('2312.26.extra')).toBe(false); // Non-numeric build number
    });
  });
});
