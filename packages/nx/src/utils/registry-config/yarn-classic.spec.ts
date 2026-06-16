// os.homedir() ignores a runtime process.env.HOME override under jest, and a
// spyOn does not affect a module's named import either, so replace both modules
// (matching how yarn resolves the home dir) and drive every surface off an
// in-memory file map for full isolation from the real filesystem.
jest.mock('os', () => ({
  ...jest.requireActual('os'),
  homedir: jest.fn(() => '/home/user'),
}));
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  existsSync: jest.fn(),
  readFileSync: jest.fn(),
}));

import * as fs from 'fs';
import { homedir } from 'os';
import { resolve } from 'path';
import { getYarnClassicSpawnRegistryEnv } from './yarn-classic';

describe('getYarnClassicSpawnRegistryEnv', () => {
  const ROOT = '/repo/workspace';
  const HOME = '/home/user';
  const PREFIX = '/prefix';
  // files keyed by absolute path; absent paths read as missing.
  let files: Record<string, string>;
  const managedEnvKeys = [
    'npm_config_registry',
    'NPM_CONFIG_REGISTRY',
    'YARN_REGISTRY',
    'yarn_registry',
    'npm_config_@types:registry',
    'PREFIX',
    'FAKEROOTKEY',
  ];
  const savedEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    files = {};
    (homedir as jest.Mock).mockReturnValue(HOME);
    (fs.existsSync as jest.Mock).mockImplementation(
      (p: any) => typeof p === 'string' && p in files
    );
    (fs.readFileSync as jest.Mock).mockImplementation((p: any) => {
      if (typeof p === 'string' && p in files) {
        return files[p];
      }
      throw Object.assign(new Error(`ENOENT: ${p}`), { code: 'ENOENT' });
    });
    for (const key of managedEnvKeys) {
      savedEnv[key] = process.env[key];
      delete process.env[key];
    }
    // Anchor the <globalPrefix>/etc tier at a controlled directory.
    process.env.PREFIX = PREFIX;
  });

  afterEach(() => {
    jest.restoreAllMocks();
    for (const key of managedEnvKeys) {
      if (savedEnv[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = savedEnv[key];
      }
    }
  });

  it('bridges nothing without registry config (yarn default maps to npmjs)', () => {
    expect(getYarnClassicSpawnRegistryEnv('is-even', ROOT)).toEqual({});
  });

  it('bridges a project .yarnrc registry', () => {
    files[`${ROOT}/.yarnrc`] = 'registry "https://reg-a.example.com/"\n';
    expect(getYarnClassicSpawnRegistryEnv('is-even', ROOT)).toEqual({
      npm_config_registry: 'https://reg-a.example.com/',
    });
  });

  it('bridges nothing when the .yarnrc registry is the yarn default', () => {
    files[`${ROOT}/.yarnrc`] = 'registry "https://registry.yarnpkg.com"\n';
    expect(getYarnClassicSpawnRegistryEnv('is-even', ROOT)).toEqual({});
  });

  it('lets a project .npmrc beat the project .yarnrc (npm reads it natively)', () => {
    files[`${ROOT}/.npmrc`] = 'registry=https://reg-b.example.com/';
    files[`${ROOT}/.yarnrc`] = 'registry "https://reg-a.example.com/"\n';
    expect(getYarnClassicSpawnRegistryEnv('is-even', ROOT)).toEqual({});
  });

  it('lets even a user ~/.npmrc beat a project .yarnrc', () => {
    files[`${HOME}/.npmrc`] = 'registry=https://reg-b.example.com/';
    files[`${ROOT}/.yarnrc`] = 'registry "https://reg-a.example.com/"\n';
    expect(getYarnClassicSpawnRegistryEnv('is-even', ROOT)).toEqual({});
  });

  it('lets npm_config_registry env beat everything (native)', () => {
    process.env.npm_config_registry = 'https://reg-c.example.com/';
    files[`${ROOT}/.yarnrc`] = 'registry "https://reg-a.example.com/"\n';
    expect(getYarnClassicSpawnRegistryEnv('is-even', ROOT)).toEqual({});
  });

  it('bridges YARN_REGISTRY env (beats .npmrc files in yarn)', () => {
    process.env.YARN_REGISTRY = 'https://reg-c.example.com/';
    files[`${ROOT}/.npmrc`] = 'registry=https://reg-b.example.com/';
    expect(getYarnClassicSpawnRegistryEnv('is-even', ROOT)).toEqual({
      npm_config_registry: 'https://reg-c.example.com/',
    });
  });

  it('bridges an ancestor .npmrc registry (npm stops walking at the workspace root)', () => {
    files['/repo/.npmrc'] = 'registry=https://reg-d.example.com/';
    expect(getYarnClassicSpawnRegistryEnv('is-even', ROOT)).toEqual({
      npm_config_registry: 'https://reg-d.example.com/',
    });
  });

  it('bridges a <prefix>/etc/yarnrc registry (npm never reads .yarnrc)', () => {
    files[`${PREFIX}/etc/yarnrc`] = 'registry "https://reg-h.example.com/"\n';
    expect(getYarnClassicSpawnRegistryEnv('is-even', ROOT)).toEqual({
      npm_config_registry: 'https://reg-h.example.com/',
    });
  });

  it('lets <prefix>/etc/npmrc (npm-native) shadow an ancestor .npmrc without bridging', () => {
    // yarn ranks etc above ancestors; etc/npmrc is npm-native, so neither is bridged.
    files[`${PREFIX}/etc/npmrc`] = 'registry=https://reg-etc.example.com/';
    files['/repo/.npmrc'] = 'registry=https://reg-d.example.com/';
    expect(getYarnClassicSpawnRegistryEnv('is-even', ROOT)).toEqual({});
  });

  it('bridges a --registry CLI line in .yarnrc above npm_config_registry env', () => {
    process.env.npm_config_registry = 'https://reg-c.example.com/';
    files[`${ROOT}/.yarnrc`] = '--registry "https://reg-cli.example.com/"\n';
    expect(getYarnClassicSpawnRegistryEnv('is-even', ROOT)).toEqual({
      npm_config_registry: 'https://reg-cli.example.com/',
    });
  });

  it('prefers --install.registry over --registry in .yarnrc', () => {
    files[`${ROOT}/.yarnrc`] = [
      '--registry "https://reg-cli.example.com/"',
      '--install.registry "https://reg-install.example.com/"',
    ].join('\n');
    expect(getYarnClassicSpawnRegistryEnv('is-even', ROOT)).toEqual({
      npm_config_registry: 'https://reg-install.example.com/',
    });
  });

  it('lets a home ~/.yarnrc --registry beat a project --registry (yarn CLI args merge last-wins)', () => {
    files[`${HOME}/.yarnrc`] = '--registry "https://reg-home.example.com/"\n';
    files[`${ROOT}/.yarnrc`] = '--registry "https://reg-proj.example.com/"\n';
    expect(getYarnClassicSpawnRegistryEnv('is-even', ROOT)).toEqual({
      npm_config_registry: 'https://reg-home.example.com/',
    });
  });

  it('bridges a .yarnrc scoped registry, also over an .npmrc unscoped registry', () => {
    files[`${ROOT}/.yarnrc`] =
      '"@types:registry" "https://reg-e.example.com/"\n';
    files[`${ROOT}/.npmrc`] = 'registry=https://reg-b.example.com/';
    expect(getYarnClassicSpawnRegistryEnv('@types/node', ROOT)).toEqual({
      'npm_config_@types:registry': 'https://reg-e.example.com/',
    });
  });

  it('lets an .npmrc scoped registry beat the .yarnrc scoped registry (native)', () => {
    files[`${ROOT}/.npmrc`] = '@types:registry=https://reg-f.example.com/';
    files[`${ROOT}/.yarnrc`] =
      '"@types:registry" "https://reg-e.example.com/"\n';
    expect(getYarnClassicSpawnRegistryEnv('@types/node', ROOT)).toEqual({});
  });

  it('bridges an ancestor .npmrc scoped registry', () => {
    files['/repo/.npmrc'] = '@types:registry=https://reg-g.example.com/';
    expect(getYarnClassicSpawnRegistryEnv('@types/node', ROOT)).toEqual({
      'npm_config_@types:registry': 'https://reg-g.example.com/',
    });
  });

  it('does not apply scoped keys to unscoped packages', () => {
    files[`${ROOT}/.yarnrc`] =
      '"@types:registry" "https://reg-e.example.com/"\n';
    expect(getYarnClassicSpawnRegistryEnv('is-even', ROOT)).toEqual({});
  });

  it('bridges .yarnrc cafile (resolved absolute) and bare strict-ssl false', () => {
    files[`${ROOT}/.yarnrc`] = [
      'cafile "./certs/ca.pem"',
      'strict-ssl false',
    ].join('\n');
    expect(getYarnClassicSpawnRegistryEnv('is-even', ROOT)).toEqual({
      npm_config_cafile: resolve(ROOT, './certs/ca.pem'),
      npm_config_strict_ssl: 'false',
    });
  });

  it('keeps TLS on for a quoted strict-ssl "false" (yarn Boolean-coerces it to a truthy string)', () => {
    files[`${ROOT}/.yarnrc`] = 'strict-ssl "false"\n';
    expect(getYarnClassicSpawnRegistryEnv('is-even', ROOT)).toEqual({});
  });

  it('expands a ~/ cafile against the home dir', () => {
    files[`${ROOT}/.yarnrc`] = 'cafile "~/certs/ca.pem"\n';
    expect(getYarnClassicSpawnRegistryEnv('is-even', ROOT)).toEqual({
      npm_config_cafile: resolve(HOME, 'certs/ca.pem'),
    });
  });

  it('leaves .npmrc cafile to npm (native)', () => {
    files[`${ROOT}/.npmrc`] = 'cafile=./certs/ca.pem';
    expect(getYarnClassicSpawnRegistryEnv('is-even', ROOT)).toEqual({});
  });

  it('bridges proxy and https-proxy from .yarnrc', () => {
    files[`${ROOT}/.yarnrc`] = [
      'proxy "http://proxy.example.com:8080"',
      'https-proxy "http://proxy.example.com:8443"',
    ].join('\n');
    expect(getYarnClassicSpawnRegistryEnv('is-even', ROOT)).toEqual({
      npm_config_proxy: 'http://proxy.example.com:8080',
      npm_config_https_proxy: 'http://proxy.example.com:8443',
    });
  });

  // process.getuid only exists on POSIX, where the root home tier applies.
  const itPosix = process.platform === 'win32' ? it.skip : it;
  itPosix('reads the root /usr/local/share home when running as root', () => {
    const getuid = jest
      .spyOn(process, 'getuid' as any)
      .mockReturnValue(0 as any);
    try {
      files['/usr/local/share/.yarnrc'] =
        'registry "https://reg-root.example.com/"\n';
      expect(getYarnClassicSpawnRegistryEnv('is-even', ROOT)).toEqual({
        npm_config_registry: 'https://reg-root.example.com/',
      });
    } finally {
      getuid.mockRestore();
    }
  });

  itPosix(
    'expands a ~/ cafile against /usr/local/share when running as root',
    () => {
      const getuid = jest
        .spyOn(process, 'getuid' as any)
        .mockReturnValue(0 as any);
      try {
        files[`${ROOT}/.yarnrc`] = 'cafile "~/certs/ca.pem"\n';
        expect(getYarnClassicSpawnRegistryEnv('is-even', ROOT)).toEqual({
          npm_config_cafile: resolve('/usr/local/share', 'certs/ca.pem'),
        });
      } finally {
        getuid.mockRestore();
      }
    }
  );

  it('ignores a trailing comment on a .yarnrc value line', () => {
    files[`${ROOT}/.yarnrc`] = 'registry "https://reg-a.example.com/" # prod\n';
    expect(getYarnClassicSpawnRegistryEnv('is-even', ROOT)).toEqual({
      npm_config_registry: 'https://reg-a.example.com/',
    });
  });

  it('bridges an ancestor .npmrc registry but not its auth for an unscoped fetch (yarn sends none without always-auth)', () => {
    files['/repo/.npmrc'] = [
      'registry=https://reg-d.example.com/',
      '//reg-d.example.com/:_authToken=ancestor-token',
    ].join('\n');
    expect(getYarnClassicSpawnRegistryEnv('is-even', ROOT)).toEqual({
      npm_config_registry: 'https://reg-d.example.com/',
    });
  });

  it('bridges an unscoped registry auth token when global always-auth is set', () => {
    files['/repo/.npmrc'] = [
      'registry=https://reg-d.example.com/',
      '//reg-d.example.com/:_authToken=ancestor-token',
      'always-auth=true',
    ].join('\n');
    expect(getYarnClassicSpawnRegistryEnv('is-even', ROOT)).toEqual({
      npm_config_registry: 'https://reg-d.example.com/',
      'npm_config_//reg-d.example.com/:_authToken': 'ancestor-token',
    });
  });

  it('bridges an unscoped registry auth token when a registry-scoped always-auth is set', () => {
    files['/repo/.npmrc'] = [
      'registry=https://reg-d.example.com/',
      '//reg-d.example.com/:_authToken=ancestor-token',
      '//reg-d.example.com/:always-auth=true',
    ].join('\n');
    expect(getYarnClassicSpawnRegistryEnv('is-even', ROOT)).toEqual({
      npm_config_registry: 'https://reg-d.example.com/',
      'npm_config_//reg-d.example.com/:_authToken': 'ancestor-token',
    });
  });

  it('resolves always-auth from .yarnrc over the .npmrc chain', () => {
    // always-auth is an option key, so .yarnrc wins; a bare `false` there keeps
    // auth off even though an ancestor .npmrc sets it true.
    files['/repo/.npmrc'] = [
      'registry=https://reg-d.example.com/',
      '//reg-d.example.com/:_authToken=ancestor-token',
      'always-auth=true',
    ].join('\n');
    files[`${ROOT}/.yarnrc`] = 'always-auth false\n';
    expect(getYarnClassicSpawnRegistryEnv('is-even', ROOT)).toEqual({
      npm_config_registry: 'https://reg-d.example.com/',
    });
  });

  it('leaves a project .npmrc auth token to npm (native)', () => {
    files[`${ROOT}/.npmrc`] = [
      'registry=https://reg-b.example.com/',
      '//reg-b.example.com/:_authToken=project-token',
    ].join('\n');
    expect(getYarnClassicSpawnRegistryEnv('is-even', ROOT)).toEqual({});
  });

  it('bridges a yarn-only auth token for a scoped fetch even without always-auth', () => {
    // The scoped registry is project-native (npm reads it), but the token lives
    // only in an ancestor .npmrc. A scoped fetch always authenticates, so npm
    // would hit the registry unauthenticated without the bridge.
    files[`${ROOT}/.npmrc`] = '@types:registry=https://reg-b.example.com/';
    files['/repo/.npmrc'] = '//reg-b.example.com/:_authToken=ancestor-token';
    expect(getYarnClassicSpawnRegistryEnv('@types/node', ROOT)).toEqual({
      'npm_config_//reg-b.example.com/:_authToken': 'ancestor-token',
    });
  });

  it('bridges yarn-only nerf-darted _auth, username, and _password for a scoped fetch', () => {
    // All three credential forms live only in an ancestor .npmrc (yarn-only); a
    // scoped fetch authenticates, so they bridge for the spawned npm.
    files['/repo/.npmrc'] = [
      '@sc:registry=https://reg-d.example.com/',
      '//reg-d.example.com/:_auth=ZmFrZS1iYXNlNjQ=',
      '//reg-d.example.com/:username=alice',
      '//reg-d.example.com/:_password=ZmFrZS1wYXNz',
    ].join('\n');
    expect(getYarnClassicSpawnRegistryEnv('@sc/pkg', ROOT)).toEqual({
      'npm_config_@sc:registry': 'https://reg-d.example.com/',
      'npm_config_//reg-d.example.com/:_auth': 'ZmFrZS1iYXNlNjQ=',
      'npm_config_//reg-d.example.com/:username': 'alice',
      'npm_config_//reg-d.example.com/:_password': 'ZmFrZS1wYXNz',
    });
  });

  it('bridges yarn-only bare _auth, username, and _password keys when always-auth is set', () => {
    files['/repo/.npmrc'] = [
      '_auth=ZmFrZS1iYXNlNjQ=',
      'username=alice',
      '_password=ZmFrZS1wYXNz',
      'always-auth=true',
    ].join('\n');
    expect(getYarnClassicSpawnRegistryEnv('is-even', ROOT)).toEqual({
      npm_config__auth: 'ZmFrZS1iYXNlNjQ=',
      npm_config_username: 'alice',
      npm_config__password: 'ZmFrZS1wYXNz',
    });
  });
});
