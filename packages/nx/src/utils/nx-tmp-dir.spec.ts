import { isAbsolute } from 'node:path';

/**
 * `NX_HOME_TMP_DIR` is resolved once at module scope, so each case re-imports
 * the module with `node:os` staged rather than mutating anything afterwards.
 */
async function loadHomeTmpDir(
  homedir: () => string
): Promise<string | undefined> {
  vi.resetModules();
  vi.doMock('node:os', async () => ({
    ...require('node:os'),
    homedir,
  }));
  return (await import('./nx-tmp-dir')).NX_HOME_TMP_DIR;
}

describe('NX_HOME_TMP_DIR', () => {
  afterEach(() => {
    vi.doUnmock('node:os');
  });

  it('sits beneath the home directory when there is one', async () => {
    const dir = await loadHomeTmpDir(() => '/home/ada');

    expect(dir).toEqual('/home/ada/.nx');
    expect(isAbsolute(dir!)).toBe(true);
  });

  // A rootless container running as an arbitrary uid has neither $HOME nor a
  // passwd entry. `join('', '.nx')` is the *relative* path `.nx`, which would
  // put sockets in the working directory and point removeSocketDir's recursive
  // delete at it.
  it.each([
    ['an empty string', () => ''],
    ['a relative path', () => 'not/absolute'],
  ])(
    'is undefined when the home directory resolves to %s',
    async (_label: string, homedir: () => string) => {
      expect(await loadHomeTmpDir(homedir)).toBeUndefined();
    }
  );

  it('is undefined rather than throwing when there is no home directory', async () => {
    // The native binding loader imports this module, so a throw at module scope
    // would take out startup rather than one location.
    expect(
      await loadHomeTmpDir(() => {
        throw Object.assign(new Error('uv_os_homedir'), { code: 'ENOENT' });
      })
    ).toBeUndefined();
  });
});
