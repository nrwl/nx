import { isIoSnapshotFetchEnabled } from './config';

const cloud = vi.hoisted(() => ({ disabled: false }));
vi.mock('../utils/nx-cloud-utils', () => ({
  isNxCloudUsed: () => true,
  isNxCloudDisabled: () => cloud.disabled,
}));
vi.mock('../utils/git-utils', () => ({ getLatestCommitSha: () => 'head' }));

describe('isIoSnapshotFetchEnabled', () => {
  const nxJson = {} as any;

  beforeEach(() => {
    cloud.disabled = false;
  });

  it('is on when a run opts in', () => {
    expect(
      isIoSnapshotFetchEnabled(nxJson, {}, { NX_IO_SNAPSHOTS: 'true' })
    ).toBe(true);
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
      expect(isIoSnapshotFetchEnabled(nxJson, {}, env)).toBe(false);
    }
  });

  it('is off when Nx Cloud is disabled, opt-in or not', () => {
    cloud.disabled = true;
    expect(
      isIoSnapshotFetchEnabled(nxJson, {}, { NX_IO_SNAPSHOTS: 'true' })
    ).toBe(false);
    cloud.disabled = false;
    expect(
      isIoSnapshotFetchEnabled(
        nxJson,
        { cloud: false },
        { NX_IO_SNAPSHOTS: 'true' }
      )
    ).toBe(false);
  });

  it('reads the run env by default', () => {
    delete process.env.NX_IO_SNAPSHOTS;
    expect(isIoSnapshotFetchEnabled(nxJson)).toBe(false);
    process.env.NX_IO_SNAPSHOTS = 'true';
    expect(isIoSnapshotFetchEnabled(nxJson)).toBe(true);
    delete process.env.NX_IO_SNAPSHOTS;
  });
});
