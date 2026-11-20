import { createRequire } from 'module';

const tls: typeof import('tls') = createRequire(__filename)('tls');
const caApiDescriptor = Object.getOwnPropertyDescriptor(
  tls,
  'getCACertificates'
);

describe('createApiHttpClient', () => {
  let warn: ReturnType<typeof vi.spyOn>;
  let createHttpClient: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.resetModules();
    // logger is required lazily, so assert on the console it writes to
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    createHttpClient = vi.fn();
    vi.doMock('../../utils/http-client', async (importOriginal) => ({
      ...(await importOriginal<object>()),
      createHttpClient,
    }));
  });

  afterEach(() => {
    if (caApiDescriptor) {
      Object.defineProperty(tls, 'getCACertificates', caApiDescriptor);
    } else {
      delete (tls as any).getCACertificates;
    }
    vi.restoreAllMocks();
    vi.doUnmock('../../utils/http-client');
  });

  it('should pass useSystemCa to the HTTP client when Node supports it', async () => {
    Object.defineProperty(tls, 'getCACertificates', {
      value: () => [],
      configurable: true,
      writable: true,
    });
    const { createApiHttpClient } = await import('./nx-cloud-http-client');

    createApiHttpClient({ useSystemCa: true });

    expect(createHttpClient).toHaveBeenCalledWith(
      expect.objectContaining({ useSystemCa: true })
    );
    expect(warn).not.toHaveBeenCalled();
  });

  it('should warn and keep default trust when Node cannot provide system CAs', async () => {
    delete (tls as any).getCACertificates;
    const { createApiHttpClient } = await import('./nx-cloud-http-client');

    createApiHttpClient({ useSystemCa: true });

    expect(createHttpClient).toHaveBeenCalledWith(
      expect.not.objectContaining({ useSystemCa: expect.anything() })
    );
    expect(warn).toHaveBeenCalledWith(
      expect.stringMatching(
        /useSystemCa is ignored.*Node\.js 22\.15\.0\+ or 23\.10\.0\+.*NODE_EXTRA_CA_CERTS/
      )
    );
  });

  it('should not enable system CAs by default', async () => {
    const { createApiHttpClient } = await import('./nx-cloud-http-client');

    createApiHttpClient({});

    expect(createHttpClient).toHaveBeenCalledWith(
      expect.not.objectContaining({ useSystemCa: expect.anything() })
    );
  });
});
