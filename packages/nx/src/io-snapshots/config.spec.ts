import { ioSnapshotEnv, isIoSnapshotFetchEnabled } from './config';

describe('isIoSnapshotFetchEnabled', () => {
  const connected = { nxCloudId: 'id' } as any;
  const optedIn = { NX_IO_SNAPSHOTS: 'true' };

  beforeEach(() => vi.stubEnv('CI', 'true'));
  afterEach(() => vi.unstubAllEnvs());

  it('is on when a run in a connected workspace opts in', () => {
    expect(isIoSnapshotFetchEnabled(connected, {}, optedIn)).toBe(true);
  });

  // Connecting a workspace to Nx Cloud is not the opt-in: a run that says
  // nothing hashes exactly as it does today.
  it('is off until then, whatever else the env says', () => {
    for (const env of [
      {},
      { NX_IO_SNAPSHOTS: '' },
      { NX_IO_SNAPSHOTS: 'false' },
      { NX_IO_SNAPSHOTS: '1' },
      { NX_IO_SNAPSHOTS: 'TRUE' },
    ]) {
      expect(isIoSnapshotFetchEnabled(connected, {}, env)).toBe(false);
    }
  });

  it('is off outside CI, opt-in or not', () => {
    vi.stubEnv('CI', 'false');
    expect(isIoSnapshotFetchEnabled(connected, {}, optedIn)).toBe(false);
  });

  it('is off in a workspace that does not use Nx Cloud, opt-in or not', () => {
    expect(isIoSnapshotFetchEnabled({} as any, {}, optedIn)).toBe(false);
  });

  it("counts a Cloud token in the run's env as using Nx Cloud", () => {
    expect(
      isIoSnapshotFetchEnabled(
        {} as any,
        {},
        { ...optedIn, hasNxCloudToken: true }
      )
    ).toBe(true);
  });

  it('is off when Nx Cloud is disabled, opt-in or not', () => {
    expect(
      isIoSnapshotFetchEnabled(
        connected,
        {},
        { ...optedIn, NX_NO_CLOUD: 'true' }
      )
    ).toBe(false);
    expect(
      isIoSnapshotFetchEnabled(
        { ...connected, neverConnectToCloud: true },
        {},
        optedIn
      )
    ).toBe(false);
    expect(isIoSnapshotFetchEnabled(connected, { cloud: false }, optedIn)).toBe(
      false
    );
  });

  it('reads the run env by default', () => {
    delete process.env.NX_IO_SNAPSHOTS;
    expect(isIoSnapshotFetchEnabled(connected)).toBe(false);
    process.env.NX_IO_SNAPSHOTS = 'true';
    expect(isIoSnapshotFetchEnabled(connected)).toBe(true);
    delete process.env.NX_IO_SNAPSHOTS;
  });
});

describe('ioSnapshotEnv', () => {
  it('carries whether a Cloud token is set, never the token', () => {
    const env = ioSnapshotEnv({ NX_CLOUD_ACCESS_TOKEN: 'secret' });
    expect(env.hasNxCloudToken).toBe(true);
    expect(JSON.stringify(env)).not.toContain('secret');
    expect(
      ioSnapshotEnv({ NX_CLOUD_AUTH_TOKEN: 'secret' }).hasNxCloudToken
    ).toBe(true);
    expect(ioSnapshotEnv({}).hasNxCloudToken).toBe(false);
  });
});
