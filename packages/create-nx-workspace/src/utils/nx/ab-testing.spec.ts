import {
  isEnterpriseCloudUrl,
  getBannerVariant,
  shouldShowCloudPrompt,
  getFlowVariant,
} from './ab-testing';

describe('ab-testing', () => {
  describe('isEnterpriseCloudUrl', () => {
    it('should return false for cloud.nx.app', () => {
      expect(isEnterpriseCloudUrl('https://cloud.nx.app/connect/abc123')).toBe(
        false
      );
    });

    it('should return false for eu.nx.app', () => {
      expect(isEnterpriseCloudUrl('https://eu.nx.app/connect/abc123')).toBe(
        false
      );
    });

    it('should return false for staging.nx.app', () => {
      expect(
        isEnterpriseCloudUrl('https://staging.nx.app/connect/abc123')
      ).toBe(false);
    });

    it('should return false for snapshot.nx.app', () => {
      expect(
        isEnterpriseCloudUrl('https://snapshot.nx.app/connect/abc123')
      ).toBe(false);
    });

    it('should return true for enterprise URLs', () => {
      expect(
        isEnterpriseCloudUrl('https://enterprise.company.com/connect/abc123')
      ).toBe(true);
      expect(
        isEnterpriseCloudUrl('https://nx.acme-corp.com/connect/abc123')
      ).toBe(true);
    });

    it('should return false for undefined/null', () => {
      expect(isEnterpriseCloudUrl(undefined)).toBe(false);
      expect(isEnterpriseCloudUrl('')).toBe(false);
    });

    it('should return false for invalid URLs', () => {
      expect(isEnterpriseCloudUrl('not-a-url')).toBe(false);
    });
  });

  describe('getFlowVariant', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      jest.resetModules();
      process.env = { ...originalEnv };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it('should return 0 for docs generation', () => {
      process.env.NX_GENERATE_DOCS_PROCESS = 'true';
      const { getFlowVariant: freshGetFlowVariant } = jest.requireActual(
        './ab-testing'
      ) as typeof import('./ab-testing');
      expect(freshGetFlowVariant()).toBe('0');
    });
  });

  describe('getBannerVariant', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      jest.resetModules();
      process.env = { ...originalEnv };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it('should return 0 for docs generation', () => {
      process.env.NX_GENERATE_DOCS_PROCESS = 'true';
      const { getBannerVariant: freshGetBannerVariant } = jest.requireActual(
        './ab-testing'
      ) as typeof import('./ab-testing');
      expect(freshGetBannerVariant('https://cloud.nx.app/connect/abc')).toBe(
        '0'
      );
    });

    it('should return 0 for enterprise URLs', () => {
      expect(
        getBannerVariant('https://enterprise.company.com/connect/abc')
      ).toBe('0');
    });

    it('should return 2 for standard URLs (locked in CLOUD-4255)', () => {
      expect(getBannerVariant('https://cloud.nx.app/connect/abc')).toBe('2');
    });
  });

  describe('shouldShowCloudPrompt', () => {
    it('should always return false (variant 2 locked in CLOUD-4255)', () => {
      expect(shouldShowCloudPrompt()).toBe(false);
    });
  });
});
