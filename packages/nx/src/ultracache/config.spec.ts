import { ultracacheEnv, isUltracacheConfigurationFetchEnabled } from './config';

describe('isUltracacheConfigurationFetchEnabled', () => {
  const connected = { nxCloudId: 'id' } as any;
  const optedIn = { NX_CLOUD_USE_ULTRACACHE: 'true' };

  beforeEach(() => vi.stubEnv('CI', 'true'));
  afterEach(() => vi.unstubAllEnvs());

  it('is on by default in CI for a connected workspace', () => {
    for (const env of [
      {},
      // CI expands an unset variable to ''.
      { NX_CLOUD_USE_ULTRACACHE: '' },
      optedIn,
    ]) {
      expect(isUltracacheConfigurationFetchEnabled(connected, {}, env)).toBe(
        true
      );
    }
  });

  it('is off when a run opts out', () => {
    expect(
      isUltracacheConfigurationFetchEnabled(
        connected,
        {},
        { NX_CLOUD_USE_ULTRACACHE: 'false' }
      )
    ).toBe(false);
  });

  it('is off outside CI, even when opted in', () => {
    vi.stubEnv('CI', 'false');
    expect(isUltracacheConfigurationFetchEnabled(connected, {}, optedIn)).toBe(
      false
    );
  });

  it('is off in a workspace that does not use Nx Cloud, even when opted in', () => {
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

  it('is off when Nx Cloud is disabled, even when opted in', () => {
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
    vi.stubEnv('NX_CLOUD_USE_ULTRACACHE', 'false');
    expect(isUltracacheConfigurationFetchEnabled(connected)).toBe(false);
    vi.stubEnv('NX_CLOUD_USE_ULTRACACHE', undefined);
    expect(isUltracacheConfigurationFetchEnabled(connected)).toBe(true);
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
});
