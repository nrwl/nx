import { isEnterpriseCloudUrl, getBannerVariant } from './ab-testing';

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
      // Re-import to get fresh module state
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

    it('should respect NX_CNW_FLOW_VARIANT env variable', () => {
      process.env.NX_CNW_FLOW_VARIANT = '2';
      const { getBannerVariant: freshGetBannerVariant } = jest.requireActual(
        './ab-testing'
      ) as typeof import('./ab-testing');
      expect(freshGetBannerVariant('https://cloud.nx.app/connect/abc')).toBe(
        '2'
      );
    });

    it('should return a valid variant (0, 1, 2, or 3) for standard URLs', () => {
      const variant = getBannerVariant('https://cloud.nx.app/connect/abc');
      expect(['0', '1', '2', '3']).toContain(variant);
    });
  });
});
