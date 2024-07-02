import {
  removeVersionModifier,
  compareCalver,
  getNxCloudVersion,
} from './url-shorten';

jest.mock('axios', () => ({
  get: jest.fn(),
}));

describe('URL shorten various functions', () => {
  describe('compareCalver', () => {
    it('should return 1 if the first version is newer', () => {
      expect(compareCalver('2024.07.01', '2023.12.25')).toBe(1);
      expect(compareCalver('2024.01.01', '2023.12.31')).toBe(1);
      expect(compareCalver('2023.12.26', '2023.12.25')).toBe(1);
      expect(compareCalver('2023.12.25', '2023.11.25')).toBe(1);
      expect(compareCalver('2023.12.25', '2023.12.24')).toBe(1);
    });

    it('should return -1 if the first version is older', () => {
      expect(compareCalver('2023.12.25', '2024.07.01')).toBe(-1);
      expect(compareCalver('2023.12.31', '2024.01.01')).toBe(-1);
      expect(compareCalver('2023.12.25', '2023.12.26')).toBe(-1);
      expect(compareCalver('2023.11.25', '2023.12.25')).toBe(-1);
      expect(compareCalver('2023.12.24', '2023.12.25')).toBe(-1);
    });

    it('should return 0 if both versions are the same', () => {
      expect(compareCalver('2023.12.25', '2023.12.25')).toBe(0);
      expect(compareCalver('2024.07.01', '2024.07.01')).toBe(0);
    });

    it('should return the correct version if the input has less than 3 parts', () => {
      expect(removeVersionModifier('2024.07')).toBe('2024.07');
      expect(removeVersionModifier('2024')).toBe('2024');
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

    it('should return an empty string if the input is an empty string', () => {
      expect(removeVersionModifier('')).toBe('');
    });

    it('should return the correct version if the input has less than 3 parts', () => {
      expect(removeVersionModifier('2024.07')).toBe('2024.07');
      expect(removeVersionModifier('2024')).toBe('2024');
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
});
