import {
  isEnterpriseCloudUrl,
  getBannerVariant,
  getFlowVariant,
  NX_CLOUD_HYPERLINK,
  NX_CLOUD_URL,
  PromptMessages,
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

    it('should return 2 for standard URLs', () => {
      expect(getBannerVariant('https://cloud.nx.app/connect/abc')).toBe('2');
    });
  });

  describe('setupNxCloudV2 prompt', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      jest.resetModules();
      process.env = { ...originalEnv };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it.each(['0', '1', '2'])(
      'should return the same prompt for flow variant %s',
      (flowVariant) => {
        jest.resetModules();
        process.env.NX_CNW_FLOW_VARIANT = flowVariant;
        const { PromptMessages: FreshPromptMessages } = require('./ab-testing');
        const pm = new FreshPromptMessages();
        expect(pm.getPrompt('setupNxCloudV2').code).toBe(
          'cloud-ci-providers-speed'
        );
      }
    );

    it('should return the same prompt for docs generation', () => {
      process.env.NX_GENERATE_DOCS_PROCESS = 'true';
      const { PromptMessages: FreshPromptMessages } = jest.requireActual(
        './ab-testing'
      ) as typeof import('./ab-testing');
      const pm = new FreshPromptMessages();
      expect(pm.getPrompt('setupNxCloudV2').code).toBe(
        'cloud-ci-providers-speed'
      );
    });
  });
});

describe('NX_CLOUD_HYPERLINK', () => {
  const BEL = '\u0007';
  const OSC = '\u001B]';
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('embeds UTM attribution in the link target while keeping the visible text clean', () => {
    process.env.FORCE_HYPERLINK = '1';
    const { NX_CLOUD_HYPERLINK: link, NX_CLOUD_URL: url } = jest.requireActual(
      './ab-testing'
    ) as typeof import('./ab-testing');

    expect(link).toContain(`${BEL}${url}${OSC}`);
    expect(link).toContain(
      `${url}?utm_source=nx-cli&utm_medium=create-nx-workspace`
    );
  });

  it('falls back to the bare URL when hyperlinks are unsupported', () => {
    process.env.FORCE_HYPERLINK = '0';
    const { NX_CLOUD_HYPERLINK: link, NX_CLOUD_URL: url } = jest.requireActual(
      './ab-testing'
    ) as typeof import('./ab-testing');

    expect(link).toBe(url);
  });
});

describe('cloud prompt footers', () => {
  let originalDocs: string | undefined;

  beforeAll(() => {
    originalDocs = process.env.NX_GENERATE_DOCS_PROCESS;
    process.env.NX_GENERATE_DOCS_PROCESS = 'true';
  });

  afterAll(() => {
    if (originalDocs === undefined) delete process.env.NX_GENERATE_DOCS_PROCESS;
    else process.env.NX_GENERATE_DOCS_PROCESS = originalDocs;
  });

  // Drift guard: every cloud prompt footer must embed the baked hyperlink so a
  // future footer edit that drops it fails loudly instead of silently losing
  // attribution.
  it.each(['setupCI', 'setupNxCloud', 'setupNxCloudV2'] as const)(
    'embeds the Nx Cloud hyperlink in %s',
    (key) => {
      const { footer } = new PromptMessages().getPrompt(key);
      expect(footer).toContain(NX_CLOUD_HYPERLINK);
    }
  );
});
