import { ultracacheEnv, isUltracacheConfigurationFetchEnabled } from './config';

describe('isUltracacheConfigurationFetchEnabled', () => {
  const connected = { nxCloudId: 'id' } as any;
  const optedIn = { NX_CLOUD_USE_ULTRACACHE: 'true' };

  beforeEach(() => vi.stubEnv('CI', 'true'));
  afterEach(() => vi.unstubAllEnvs());

  it('is on when a run in a connected workspace opts in', () => {
    expect(isUltracacheConfigurationFetchEnabled(connected, {}, optedIn)).toBe(
      true
    );
  });

  // Connecting a workspace to Nx Cloud is not the opt-in: a run that says
  // nothing hashes exactly as it does today.
  it('is off until then, whatever else the env says', () => {
    for (const env of [
      {},
      { NX_CLOUD_USE_ULTRACACHE: '' },
      { NX_CLOUD_USE_ULTRACACHE: 'false' },
      { NX_CLOUD_USE_ULTRACACHE: '1' },
      { NX_CLOUD_USE_ULTRACACHE: 'TRUE' },
      // The pre-release names are gone.
      { NX_IO_SNAPSHOTS: 'true', NX_CLOUD_USE_IO_SNAPSHOTS: 'true' } as any,
    ]) {
      expect(isUltracacheConfigurationFetchEnabled(connected, {}, env)).toBe(
        false
      );
    }
  });

  it('is off outside CI, opt-in or not', () => {
    vi.stubEnv('CI', 'false');
    expect(isUltracacheConfigurationFetchEnabled(connected, {}, optedIn)).toBe(
      false
    );
  });

  it('is off in a workspace that does not use Nx Cloud, opt-in or not', () => {
    expect(isUltracacheConfigurationFetchEnabled({} as any, {}, optedIn)).toBe(
      false
    );
  });

  it("counts a Cloud token in the run's env as using Nx Cloud", () => {
    expect(
      isUltracacheConfigurationFetchEnabled(
        {} as any,
        {},
        { ...optedIn, hasNxCloudToken: true }
      )
    ).toBe(true);
  });

  it('is off when Nx Cloud is disabled, opt-in or not', () => {
    expect(
      isUltracacheConfigurationFetchEnabled(
        connected,
        {},
        { ...optedIn, NX_NO_CLOUD: 'true' }
      )
    ).toBe(false);
    expect(
      isUltracacheConfigurationFetchEnabled(
        { ...connected, neverConnectToCloud: true },
        {},
        optedIn
      )
    ).toBe(false);
    expect(
      isUltracacheConfigurationFetchEnabled(
        connected,
        { cloud: false },
        optedIn
      )
    ).toBe(false);
  });

  it('reads the run env by default', () => {
    delete process.env.NX_CLOUD_USE_ULTRACACHE;
    expect(isUltracacheConfigurationFetchEnabled(connected)).toBe(false);
    process.env.NX_CLOUD_USE_ULTRACACHE = 'true';
    expect(isUltracacheConfigurationFetchEnabled(connected)).toBe(true);
    delete process.env.NX_CLOUD_USE_ULTRACACHE;
  });
});

describe('ultracacheEnv', () => {
  it('carries whether a Cloud token is set, never the token', () => {
    const env = ultracacheEnv({ NX_CLOUD_ACCESS_TOKEN: 'secret' });
    expect(env.hasNxCloudToken).toBe(true);
    expect(JSON.stringify(env)).not.toContain('secret');
    expect(
      ultracacheEnv({ NX_CLOUD_AUTH_TOKEN: 'secret' }).hasNxCloudToken
    ).toBe(true);
    expect(ultracacheEnv({}).hasNxCloudToken).toBe(false);
  });

  it('treats an empty NX_ULTRACACHE_COMMIT as unset', () => {
    expect(
      ultracacheEnv({ NX_ULTRACACHE_COMMIT: '' }).NX_ULTRACACHE_COMMIT
    ).toBeUndefined();
    expect(
      ultracacheEnv({ NX_ULTRACACHE_COMMIT: 'abc1234' }).NX_ULTRACACHE_COMMIT
    ).toBe('abc1234');
  });
});
