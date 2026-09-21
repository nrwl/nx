import { ioSnapshotEnv, isIoSnapshotFetchEnabled } from './config';

const cloud = vi.hoisted(() => ({ used: true, disabled: false }));
vi.mock('../utils/nx-cloud-utils', () => ({
  isNxCloudUsed: () => cloud.used,
  isNxCloudDisabled: () => cloud.disabled,
}));
const ci = vi.hoisted(() => ({ value: false as unknown }));
vi.mock('../utils/is-ci', () => ({ isCI: () => ci.value }));
vi.mock('../utils/git-utils', () => ({ getLatestCommitSha: () => 'head' }));

describe('isIoSnapshotFetchEnabled', () => {
  const nxJson = {} as any;

  beforeEach(() => {
    cloud.used = true;
    cloud.disabled = false;
    ci.value = false;
  });

  it('is on in CI when the workspace uses Nx Cloud', () => {
    expect(isIoSnapshotFetchEnabled(nxJson, {}, { ci: true })).toBe(true);
  });

  it('is off outside CI', () => {
    expect(isIoSnapshotFetchEnabled(nxJson, {}, { ci: false })).toBe(false);
  });

  // An older client sends no `ci`, and the daemon defaults to an empty env.
  // Reading that as CI would turn snapshots on for the runs this gate exists
  // to exclude, so absence must fail closed.
  it('is off when the run did not say whether it is CI', () => {
    expect(
      isIoSnapshotFetchEnabled(nxJson, {}, { NX_IO_SNAPSHOTS_MAX_AGE: '1' })
    ).toBe(false);
    expect(isIoSnapshotFetchEnabled(nxJson, {}, {})).toBe(false);
  });

  it('is forced on outside CI by the debug override', () => {
    expect(
      isIoSnapshotFetchEnabled(
        nxJson,
        {},
        { ci: false, NX_IO_SNAPSHOTS: 'true' }
      )
    ).toBe(true);
  });

  it('is off when the kill switch is set, even in CI', () => {
    expect(
      isIoSnapshotFetchEnabled(
        nxJson,
        {},
        { ci: true, NX_IO_SNAPSHOTS: 'false' }
      )
    ).toBe(false);
  });

  it('is off when Nx Cloud is disabled, override or not', () => {
    cloud.disabled = true;
    expect(
      isIoSnapshotFetchEnabled(
        nxJson,
        {},
        { ci: true, NX_IO_SNAPSHOTS: 'true' }
      )
    ).toBe(false);
    cloud.disabled = false;
    expect(
      isIoSnapshotFetchEnabled(
        nxJson,
        { cloud: false },
        { ci: true, NX_IO_SNAPSHOTS: 'true' }
      )
    ).toBe(false);
  });

  it('is off in CI when the workspace does not use Nx Cloud', () => {
    cloud.used = false;
    expect(isIoSnapshotFetchEnabled(nxJson, {}, { ci: true })).toBe(false);
  });

  it('defaults to the run env, whose ci comes from the CI check', () => {
    ci.value = 'true';
    expect(ioSnapshotEnv({} as any).ci).toBe(true);
    expect(isIoSnapshotFetchEnabled(nxJson)).toBe(true);
    ci.value = '';
    expect(ioSnapshotEnv({} as any).ci).toBe(false);
    expect(isIoSnapshotFetchEnabled(nxJson)).toBe(false);
  });
});
