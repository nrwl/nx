import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';

const fixture = vi.hoisted(() => ({ root: '', home: '' }));

vi.mock('os', async () => {
  const actual = await vi.importActual<typeof import('os')>('os');
  return { ...actual, tmpdir: () => join(fixture.root, 'shared-tmp') };
});

// Getters, so each test's fixture is read at use rather than at first import.
vi.mock('../utils/nx-tmp-dir', () => ({
  get NX_TMP_DIR() {
    return join(fixture.root, 'shared-tmp', '.nx');
  },
  get NX_USER_TMP_DIR() {
    return join(fixture.root, 'shared-tmp', '.nx', 'user');
  },
  get NX_HOME_TMP_DIR() {
    return fixture.home;
  },
  homeDirIsDistinctFromSharedTmp: () =>
    fixture.home !== join(fixture.root, 'shared-tmp', '.nx'),
}));

vi.mock('./utilities/nx-cloud-http-client', () => ({
  createApiHttpClient: () => ({
    get: () => Promise.reject(new Error('offline')),
  }),
}));

const apiHash = createHash('sha256')
  .update('https://cloud.nx.app')
  .digest('hex')
  .slice(0, 16);

/** A bundle that leaves a marker behind when it is loaded. */
function plantBundle(installDir: string, marker: string): void {
  mkdirSync(join(installDir, '1.0.0'), { recursive: true });
  writeFileSync(
    join(installDir, '1.0.0', 'index.js'),
    `require('fs').writeFileSync(${JSON.stringify(marker)}, '');
     module.exports = { commands: {} };`
  );
  mkdirSync(`${installDir}-state`, { recursive: true });
  writeFileSync(
    join(`${installDir}-state`, 'verify.lock'),
    String(Date.now() + 60 * 60 * 1000)
  );
}

describe('update-manager outside a workspace', () => {
  let workspace: string;
  let marker: string;
  const originalApi = process.env.NX_CLOUD_API;

  beforeEach(async () => {
    const { tmpdir } = await vi.importActual<typeof import('os')>('os');
    fixture.root = realpathSync(
      mkdtempSync(join(tmpdir(), 'nx-cloud-outside-'))
    );
    mkdirSync(join(fixture.root, 'shared-tmp'));
    mkdirSync(join(fixture.root, 'home'));
    fixture.home = join(fixture.root, 'home', '.nx');
    workspace = join(fixture.root, 'no-workspace');
    mkdirSync(workspace);
    marker = join(fixture.root, 'planted-bundle-loaded');
    delete process.env.NX_CLOUD_API;

    vi.resetModules();
    const { setWorkspaceRoot } = await import('../utils/workspace-root');
    setWorkspaceRoot(workspace);
  });

  afterEach(() => {
    if (originalApi === undefined) delete process.env.NX_CLOUD_API;
    else process.env.NX_CLOUD_API = originalApi;
    rmSync(fixture.root, { recursive: true, force: true });
  });

  it('installs the client under the home directory, not the shared temp dir', async () => {
    const { getBundleInstallDefaultLocation } =
      await import('./update-manager');

    expect(getBundleInstallDefaultLocation()).toBe(
      join(fixture.root, 'home', '.nx', 'cloud-client', apiHash)
    );
  });

  it('does not load a bundle pre-planted in the shared temp dir', async () => {
    plantBundle(
      join(fixture.root, 'shared-tmp', 'nx-cloud-client', apiHash),
      marker
    );
    const { verifyOrUpdateNxCloudClient } = await import('./update-manager');

    await expect(verifyOrUpdateNxCloudClient()).rejects.toThrow();
    expect(existsSync(marker)).toBe(false);
  });

  it('refuses an install root replaced by a symlink to a planted bundle', async () => {
    const planted = join(fixture.root, 'planted');
    plantBundle(join(planted, apiHash), marker);
    mkdirSync(join(fixture.root, 'home', '.nx'), { mode: 0o700 });
    symlinkSync(planted, join(fixture.root, 'home', '.nx', 'cloud-client'));
    const { verifyOrUpdateNxCloudClient } = await import('./update-manager');

    await expect(verifyOrUpdateNxCloudClient()).rejects.toThrow(/symlink/);
    expect(existsSync(marker)).toBe(false);
  });

  it('refuses to install when the home directory is the shared temp dir', async () => {
    fixture.home = join(fixture.root, 'shared-tmp', '.nx');
    const { getBundleInstallDefaultLocation, verifyOrUpdateNxCloudClient } =
      await import('./update-manager');

    expect(getBundleInstallDefaultLocation()).toBeNull();
    await expect(verifyOrUpdateNxCloudClient()).rejects.toThrow(
      /home directory/
    );
    expect(existsSync(join(fixture.root, 'shared-tmp', '.nx'))).toBe(false);
  });
});
