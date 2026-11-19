import {
  hasAlwaysInput,
  isUltracacheOnInCI,
  resetUltracacheStatus,
  ULTRACACHE_DOCS_URL,
  ultracacheDocsLink,
  ultracacheInCINotice,
  ultracacheModeInCI,
} from './ci-status';

const cloud = vi.hoisted(() => ({
  used: true,
  loadCloudClient: vi.fn(),
}));
vi.mock('../utils/nx-cloud-utils', () => ({
  isNxCloudUsed: () => cloud.used,
}));
vi.mock('../nx-cloud/utilities/get-cloud-options', () => ({
  getCloudOptions: () => ({ accessToken: 't' }),
}));
vi.mock('./fetch', () => ({ loadCloudClient: cloud.loadCloudClient }));

describe('isUltracacheOnInCI', () => {
  const nxJson = {} as any;

  beforeEach(() => {
    resetUltracacheStatus();
    cloud.used = true;
    cloud.loadCloudClient.mockReset();
  });

  it('asks the Nx Cloud client, once per process', async () => {
    const readUltracacheStatus = vi.fn(async () => ({ enabled: true }));
    cloud.loadCloudClient.mockResolvedValue({ readUltracacheStatus });

    expect(await isUltracacheOnInCI(nxJson)).toBe(true);
    expect(await isUltracacheOnInCI(nxJson)).toBe(true);
    expect(readUltracacheStatus).toHaveBeenCalledTimes(1);
    expect(readUltracacheStatus).toHaveBeenCalledWith({
      nxCloudOptions: { accessToken: 't' },
      timeoutMs: 2_000,
    });
  });

  it('is off when the workspace is not On', async () => {
    cloud.loadCloudClient.mockResolvedValue({
      readUltracacheStatus: async () => ({ enabled: false }),
    });
    expect(await isUltracacheOnInCI(nxJson)).toBe(false);
  });

  it('is off without Nx Cloud, without asking', async () => {
    cloud.used = false;
    expect(await isUltracacheOnInCI(nxJson)).toBe(false);
    expect(cloud.loadCloudClient).not.toHaveBeenCalled();
  });

  it('is off for a client without the method', async () => {
    cloud.loadCloudClient.mockResolvedValue({});
    expect(await isUltracacheOnInCI(nxJson)).toBe(false);
  });

  it('is off when the client cannot load or Nx Cloud cannot answer', async () => {
    cloud.loadCloudClient.mockRejectedValueOnce(new Error('offline'));
    expect(await isUltracacheOnInCI(nxJson)).toBe(false);

    resetUltracacheStatus();
    cloud.loadCloudClient.mockResolvedValue({
      readUltracacheStatus: async () => {
        throw new Error('Request failed with status code 404');
      },
    });
    expect(await isUltracacheOnInCI(nxJson)).toBe(false);
  });
});

describe('ultracacheModeInCI', () => {
  it('is the target mode, on by default, for a cacheable target', () => {
    expect(ultracacheModeInCI({ cache: true }, false)).toBe('on');
    for (const mode of ['on', 'warn', 'error', 'off'] as const) {
      expect(
        ultracacheModeInCI({ cache: true, ultracache: { mode } }, false)
      ).toBe(mode);
    }
  });

  it('is undefined where Ultracache does not apply', () => {
    expect(ultracacheModeInCI({}, false)).toBeUndefined();
    expect(
      ultracacheModeInCI({ cache: true, continuous: true }, false)
    ).toBeUndefined();
    expect(ultracacheModeInCI({ cache: true }, true)).toBeUndefined();
  });
});

describe('ultracacheInCINotice', () => {
  it('explains each mode', () => {
    expect(ultracacheInCINotice('on', false)).toBe(
      'In CI, file inputs are replaced by the files this task read during previous runs.'
    );
    expect(ultracacheInCINotice('warn', false)).toContain('Nx Cloud warns');
    expect(ultracacheInCINotice('error', false)).toContain(
      'Nx Cloud fails the run'
    );
    expect(ultracacheInCINotice('off', false)).toContain('not recorded');
  });

  it('mentions always inputs only in on mode, when the target has some', () => {
    expect(hasAlwaysInput(['default', { fileset: 'a', always: true }])).toBe(
      true
    );
    expect(hasAlwaysInput(['default', { fileset: 'a' }])).toBe(false);
    expect(hasAlwaysInput(undefined)).toBe(false);
    expect(ultracacheInCINotice('on', true)).toContain(
      '`always` inputs still count.'
    );
    expect(ultracacheInCINotice('warn', true)).not.toContain('always');
  });
});

describe('ultracacheDocsLink', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('is a Learn more hyperlink where the terminal supports one', () => {
    vi.stubEnv('FORCE_HYPERLINK', '1');
    const link = ultracacheDocsLink();
    expect(link).toContain('Learn more');
    expect(link).toContain(`]8;;${ULTRACACHE_DOCS_URL}`);
  });

  it('is the bare URL elsewhere', () => {
    vi.stubEnv('FORCE_HYPERLINK', '0');
    expect(ultracacheDocsLink()).toContain(ULTRACACHE_DOCS_URL);
    expect(ultracacheDocsLink()).not.toContain(']8;;');
  });
});
