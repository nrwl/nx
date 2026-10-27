import {
  existsSync,
  lutimesSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  realpathSync,
  rmSync,
  symlinkSync,
  utimesSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';

const ABSENT = '/nonexistent-nx-reset-temp-installs-spec';

vi.mock('../../nx-cloud/utilities/client', () => ({
  getCloudClient: vi.fn(async () => ({ invoke: async () => {} })),
}));
vi.mock('../../nx-cloud/utilities/get-cloud-options', () => ({
  getCloudOptions: () => ({}),
}));
vi.mock('../../nx-cloud/update-manager', () => ({
  getBundleInstallDefaultLocation: () => `${ABSENT}/cloud`,
}));
vi.mock('../../utils/nx-cloud-utils', () => ({ isNxCloudUsed: () => false }));
vi.mock('../../config/configuration', () => ({ readNxJson: () => ({}) }));
vi.mock('../../daemon/client/client', () => ({
  daemonClient: { enabled: () => false },
}));
vi.mock('../../daemon/tmp-dir', () => ({
  DAEMON_DIR_FOR_CURRENT_WORKSPACE: `${ABSENT}/daemon`,
}));
vi.mock('../../native/native-file-cache-location', () => ({
  getNativeFileCacheLocationToDelete: () => null,
}));
vi.mock('../../utils/db-connection', () => ({ removeDbConnections: () => {} }));
vi.mock('../../utils/workspace-root', () => ({ workspaceRoot: ABSENT }));
vi.mock('../../utils/cache-directory', () => ({
  cacheDir: `${ABSENT}/cache`,
  workspaceDataDirectory: `${ABSENT}/workspace-data`,
  cacheDirectoryForWorkspace: () => `${ABSENT}/cache`,
  sharedDataDirectory: () => `${ABSENT}/workspace-data`,
}));

describe('nx reset temporary package installs', () => {
  let root: string;

  beforeEach(() => {
    // Outside the shared temp dir, which is refused as a home.
    const parent = join(process.cwd(), 'tmp');
    mkdirSync(parent, { recursive: true });
    root = realpathSync(mkdtempSync(join(parent, 'nx-reset-installs-')));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
    vi.restoreAllMocks();
    rmSync(root, { recursive: true, force: true });
  });

  async function reset() {
    vi.resetModules();
    const { output } = await import('../../utils/output');
    const { globalSpinner } = await import('../../utils/spinner');
    vi.spyOn(output, 'success').mockImplementation(() => {});
    vi.spyOn(globalSpinner, 'start').mockReturnValue(globalSpinner);
    vi.spyOn(globalSpinner, 'succeed').mockImplementation(() => {});
    const { resetHandler } = await import('./reset');
    await resetHandler({});
  }

  it('removes stale install dirs, keeping fresh ones and symlink targets', async () => {
    const home = join(root, 'home');
    const installRoot = join(home, '.nx', 'tmp');
    mkdirSync(installRoot, { recursive: true, mode: 0o700 });
    const old = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    const outside = join(root, 'outside');
    mkdirSync(outside);
    writeFileSync(join(outside, 'keep'), '');
    utimesSync(outside, old, old);

    const stale = join(installRoot, 'tmp-stale');
    mkdirSync(join(stale, 'node_modules'), { recursive: true });
    symlinkSync(outside, join(stale, 'node_modules', 'linked'), 'dir');
    utimesSync(stale, old, old);
    const fresh = join(installRoot, 'tmp-fresh');
    mkdirSync(fresh);
    const link = join(installRoot, 'tmp-link');
    symlinkSync(outside, link, 'dir');
    lutimesSync(link, old, old);
    vi.stubEnv('HOME', home);
    vi.stubEnv('USERPROFILE', home);

    await reset();

    expect(existsSync(stale)).toBe(false);
    expect(existsSync(fresh)).toBe(true);
    expect(existsSync(link)).toBe(true);
    expect(readdirSync(outside)).toEqual(['keep']);
  });

  it('creates nothing when there is no install root', async () => {
    const home = join(root, 'home');
    mkdirSync(home);
    vi.stubEnv('HOME', home);
    vi.stubEnv('USERPROFILE', home);

    await reset();

    expect(readdirSync(home)).toEqual([]);
  });
});
