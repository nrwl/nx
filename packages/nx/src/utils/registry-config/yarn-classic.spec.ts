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
jest.mock('../logger', () => ({
  logger: { warn: jest.fn(), verbose: jest.fn() },
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
    'npm_config_always_auth',
    'NPM_CONFIG_ALWAYS_AUTH',
    'yarn_always_auth',
    'YARN_ALWAYS_AUTH',
    'npm_config_//localhost:4873/:always-auth',
    'yarn_//localhost:4873/:always-auth',
    'npm_config_//reg-d.example.com/:always-auth',
    'yarn_cafile',
    'YARN_CAFILE',
    'npm_config_cafile',
    'NPM_CONFIG_CAFILE',
    'yarn_strict_ssl',
    'YARN_STRICT_SSL',
    'yarn_proxy',
    'YARN_PROXY',
    'yarn_https_proxy',
    'YARN_HTTPS_PROXY',
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
    // Deleting FAKEROOTKEY above puts production on its root home tier whenever
    // the run itself is uid 0 (container CI), so pin the uid the cases below
    // assume and let the root ones opt in.
    if (process.platform !== 'win32') {
      jest.spyOn(process, 'getuid' as any).mockReturnValue(501 as any);
    }
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
    (process.getuid as jest.Mock).mockReturnValue(0);
    files['/usr/local/share/.yarnrc'] =
      'registry "https://reg-root.example.com/"\n';
    expect(getYarnClassicSpawnRegistryEnv('is-even', ROOT)).toEqual({
      npm_config_registry: 'https://reg-root.example.com/',
    });
  });

  itPosix(
    'expands a ~/ cafile against /usr/local/share when running as root',
    () => {
      (process.getuid as jest.Mock).mockReturnValue(0);
      files[`${ROOT}/.yarnrc`] = 'cafile "~/certs/ca.pem"\n';
      expect(getYarnClassicSpawnRegistryEnv('is-even', ROOT)).toEqual({
        npm_config_cafile: resolve('/usr/local/share', 'certs/ca.pem'),
      });
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

  it('ignores .yarnrc when resolving always-auth', () => {
    // The gate reads NpmRegistry's config, which loadConfig fills from the npmrc
    // chain alone, so a .yarnrc `false` cannot turn off an .npmrc `true`.
    files['/repo/.npmrc'] = [
      'registry=https://reg-d.example.com/',
      '//reg-d.example.com/:_authToken=ancestor-token',
      'always-auth=true',
    ].join('\n');
    files[`${ROOT}/.yarnrc`] = 'always-auth false\n';
    expect(getYarnClassicSpawnRegistryEnv('is-even', ROOT)).toEqual({
      npm_config_registry: 'https://reg-d.example.com/',
      'npm_config_//reg-d.example.com/:_authToken': 'ancestor-token',
    });
  });

  it.each([
    'npm_config_always_auth',
    'NPM_CONFIG_ALWAYS_AUTH',
    'YARN_ALWAYS_AUTH',
  ])('resolves always-auth from the %s env var', (envKey) => {
    // BaseRegistry merges both env prefixes before any file is read, and an
    // npmrc never overwrites what the env already set.
    files['/repo/.npmrc'] = [
      'registry=https://reg-d.example.com/',
      '//reg-d.example.com/:_authToken=ancestor-token',
    ].join('\n');
    process.env[envKey] = 'true';
    expect(getYarnClassicSpawnRegistryEnv('is-even', ROOT)).toEqual({
      npm_config_registry: 'https://reg-d.example.com/',
      'npm_config_//reg-d.example.com/:_authToken': 'ancestor-token',
    });
  });

  it.each([
    'npm_config_//localhost:4873/:always-auth',
    'yarn_//localhost:4873/:always-auth',
  ])('resolves a registry-scoped always-auth from the %s env var', (envKey) => {
    // mergeEnv stores an env key through objectPath, which splits on `.`, while
    // every read is flat, so a dot-free registry-scoped key is one yarn does
    // find (verified on 1.22.22: this authenticates an unscoped fetch).
    files['/repo/.npmrc'] = [
      'registry=http://localhost:4873/',
      '//localhost:4873/:_authToken=ancestor-token',
    ].join('\n');
    process.env[envKey] = 'true';
    expect(getYarnClassicSpawnRegistryEnv('is-even', ROOT)).toEqual({
      npm_config_registry: 'http://localhost:4873/',
      'npm_config_//localhost:4873/:_authToken': 'ancestor-token',
    });
  });

  it('ignores a registry-scoped always-auth env var for a dotted host', () => {
    // objectPath nests `//reg-d.example.com/:always-auth` under `//reg-d`, so
    // yarn's flat read never sees it and the fetch stays anonymous.
    files['/repo/.npmrc'] = [
      'registry=https://reg-d.example.com/',
      '//reg-d.example.com/:_authToken=ancestor-token',
    ].join('\n');
    process.env['npm_config_//reg-d.example.com/:always-auth'] = 'true';
    expect(getYarnClassicSpawnRegistryEnv('is-even', ROOT)).toEqual({
      npm_config_registry: 'https://reg-d.example.com/',
    });
  });

  it('lets a registry-scoped always-auth env var beat an .npmrc that disables it', () => {
    files['/repo/.npmrc'] = [
      'registry=http://localhost:4873/',
      '//localhost:4873/:_authToken=ancestor-token',
      '//localhost:4873/:always-auth=false',
    ].join('\n');
    process.env['npm_config_//localhost:4873/:always-auth'] = 'true';
    expect(getYarnClassicSpawnRegistryEnv('is-even', ROOT)).toEqual({
      npm_config_registry: 'http://localhost:4873/',
      'npm_config_//localhost:4873/:_authToken': 'ancestor-token',
    });
  });

  it('falls through to the global always-auth when a registry-scoped env var disables it', () => {
    // yarn's getRegistryOrGlobalOption ORs the two tiers, so a falsy
    // registry-scoped value does not veto a global one.
    files['/repo/.npmrc'] = [
      'registry=http://localhost:4873/',
      '//localhost:4873/:_authToken=ancestor-token',
      'always-auth=true',
    ].join('\n');
    process.env['npm_config_//localhost:4873/:always-auth'] = 'false';
    expect(getYarnClassicSpawnRegistryEnv('is-even', ROOT)).toEqual({
      npm_config_registry: 'http://localhost:4873/',
      'npm_config_//localhost:4873/:_authToken': 'ancestor-token',
    });
  });

  it('lets an always-auth env var beat an .npmrc that disables it', () => {
    files['/repo/.npmrc'] = [
      'registry=https://reg-d.example.com/',
      '//reg-d.example.com/:_authToken=ancestor-token',
      'always-auth=false',
    ].join('\n');
    process.env.YARN_ALWAYS_AUTH = 'true';
    expect(getYarnClassicSpawnRegistryEnv('is-even', ROOT)).toEqual({
      npm_config_registry: 'https://reg-d.example.com/',
      'npm_config_//reg-d.example.com/:_authToken': 'ancestor-token',
    });
  });

  it('bridges no auth for an unscoped fetch without always-auth', () => {
    // yarn stays anonymous here, so nothing is bridged whether or not npm reads
    // the file itself; the native-file guard is covered separately below.
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

  it('expands ${VAR} in a yarn-only ancestor .npmrc auth token before bridging', () => {
    // yarn classic env-replaces .npmrc values, so the bridged token carries the
    // secret yarn resolved rather than whatever npm's own grammar would make of
    // the reference.
    process.env.NX_TEST_YARN_TOKEN = 'real-token';
    try {
      files[`${ROOT}/.npmrc`] = '@types:registry=https://reg-b.example.com/';
      files['/repo/.npmrc'] =
        '//reg-b.example.com/:_authToken=${NX_TEST_YARN_TOKEN}';
      expect(getYarnClassicSpawnRegistryEnv('@types/node', ROOT)).toEqual({
        'npm_config_//reg-b.example.com/:_authToken': 'real-token',
      });
    } finally {
      delete process.env.NX_TEST_YARN_TOKEN;
    }
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

  it('re-keys yarn-only bare _auth, username, and _password onto the default registry dart when always-auth is set', () => {
    // npm honors auth only in the nerf-darted form; with no registry configured
    // the spawned npm queries its own default, so the bare creds target it.
    files['/repo/.npmrc'] = [
      '_auth=ZmFrZS1iYXNlNjQ=',
      'username=alice',
      '_password=ZmFrZS1wYXNz',
      'always-auth=true',
    ].join('\n');
    expect(getYarnClassicSpawnRegistryEnv('is-even', ROOT)).toEqual({
      'npm_config_//registry.npmjs.org/:_auth': 'ZmFrZS1iYXNlNjQ=',
      'npm_config_//registry.npmjs.org/:username': 'alice',
      'npm_config_//registry.npmjs.org/:_password': 'ZmFrZS1wYXNz',
    });
  });

  it('re-keys a yarn-only bare _authToken onto the resolved custom registry dart', () => {
    files['/repo/.npmrc'] = [
      'registry=https://reg-d.example.com/',
      '_authToken=ancestor-token',
      'always-auth=true',
    ].join('\n');
    expect(getYarnClassicSpawnRegistryEnv('is-even', ROOT)).toEqual({
      npm_config_registry: 'https://reg-d.example.com/',
      'npm_config_//reg-d.example.com/:_authToken': 'ancestor-token',
    });
  });

  it('re-keys a yarn-only bare _authToken onto the scoped registry dart for a scoped fetch', () => {
    // yarn attaches a bare global token to the registry it resolves for the
    // package, which for a scoped fetch is the scoped registry, not the default.
    files['/repo/.npmrc'] = [
      '@sc:registry=https://reg-d.example.com/',
      '_authToken=ancestor-token',
    ].join('\n');
    expect(getYarnClassicSpawnRegistryEnv('@sc/pkg', ROOT)).toEqual({
      'npm_config_@sc:registry': 'https://reg-d.example.com/',
      'npm_config_//reg-d.example.com/:_authToken': 'ancestor-token',
    });
  });

  it('prefers a yarn-only nerf-darted token over a bare one for the same registry', () => {
    // yarn's getRegistryOrGlobalOption takes the registry-scoped key first, so
    // the bare token must not overwrite it.
    files['/repo/.npmrc'] = [
      'registry=https://reg-d.example.com/',
      '//reg-d.example.com/:_authToken=scoped-token',
      '_authToken=bare-token',
      'always-auth=true',
    ].join('\n');
    expect(getYarnClassicSpawnRegistryEnv('is-even', ROOT)).toEqual({
      npm_config_registry: 'https://reg-d.example.com/',
      'npm_config_//reg-d.example.com/:_authToken': 'scoped-token',
    });
  });

  it('re-keys a bare _authToken from the workspace .npmrc onto the resolved registry dart', () => {
    // npm honors bare auth from no source, so even a native bare token (which
    // yarn sends via getOption) must be darted for the spawned npm. The registry
    // itself is npm-native, so only the token is bridged.
    files[`${ROOT}/.npmrc`] = [
      'registry=https://reg-b.example.com/',
      '_authToken=project-token',
      'always-auth=true',
    ].join('\n');
    expect(getYarnClassicSpawnRegistryEnv('is-even', ROOT)).toEqual({
      'npm_config_//reg-b.example.com/:_authToken': 'project-token',
    });
  });

  describe('the yarn_ env tier for option keys', () => {
    it('bridges YARN_CAFILE, which npm cannot see under that name', () => {
      process.env.YARN_CAFILE = './certs/env-ca.pem';
      expect(getYarnClassicSpawnRegistryEnv('is-even', ROOT)).toEqual({
        npm_config_cafile: resolve(ROOT, './certs/env-ca.pem'),
      });
    });

    it('lets YARN_CAFILE outrank the .yarnrc value', () => {
      files[`${ROOT}/.yarnrc`] = 'cafile "./certs/file-ca.pem"\n';
      process.env.YARN_CAFILE = './certs/env-ca.pem';
      expect(getYarnClassicSpawnRegistryEnv('is-even', ROOT)).toEqual({
        npm_config_cafile: resolve(ROOT, './certs/env-ca.pem'),
      });
    });

    it('defers to npm_config_cafile, which npm resolves itself', () => {
      process.env.npm_config_cafile = './certs/npm-ca.pem';
      process.env.YARN_CAFILE = './certs/env-ca.pem';
      expect(getYarnClassicSpawnRegistryEnv('is-even', ROOT)).toEqual({});
    });

    it('bridges YARN_STRICT_SSL and the proxy vars', () => {
      process.env.YARN_STRICT_SSL = 'false';
      process.env.YARN_PROXY = 'http://proxy.example.com:8080';
      process.env.YARN_HTTPS_PROXY = 'http://proxy.example.com:8443';
      expect(getYarnClassicSpawnRegistryEnv('is-even', ROOT)).toEqual({
        npm_config_strict_ssl: 'false',
        npm_config_proxy: 'http://proxy.example.com:8080',
        npm_config_https_proxy: 'http://proxy.example.com:8443',
      });
    });
  });

  it('does not bridge a strict-ssl that only an .npmrc declares', () => {
    // yarn reads strict-ssl off its own config, which no .npmrc feeds, so
    // bridging an ancestor one would disable TLS verification for the spawned
    // npm where yarn keeps it on.
    files['/repo/.npmrc'] = 'strict-ssl=false';
    expect(getYarnClassicSpawnRegistryEnv('is-even', ROOT)).toEqual({});
  });

  it('authenticates an unscoped fetch on a registry-scoped always-auth', () => {
    // yarn reads always-auth for the registry it is about to query, so a bare
    // global token is sent even though the always-auth key names the registry
    // rather than the credential.
    files['/repo/.npmrc'] = [
      'registry=https://reg-b.example.com/',
      '_authToken=ancestor-token',
      '//reg-b.example.com/:always-auth=true',
    ].join('\n');
    expect(getYarnClassicSpawnRegistryEnv('is-even', ROOT)).toEqual({
      npm_config_registry: 'https://reg-b.example.com/',
      'npm_config_//reg-b.example.com/:_authToken': 'ancestor-token',
    });
  });

  describe('.yarnrc parsing (yarn reads it with its lockfile parser)', () => {
    it('reads the key: "value" form', () => {
      files[`${ROOT}/.yarnrc`] = 'registry: "https://reg-a.example.com/"\n';
      expect(getYarnClassicSpawnRegistryEnv('is-even', ROOT)).toEqual({
        npm_config_registry: 'https://reg-a.example.com/',
      });
    });

    it('reads an unquoted path value', () => {
      files[`${ROOT}/.yarnrc`] = 'cafile ./certs/ca.pem\n';
      expect(getYarnClassicSpawnRegistryEnv('is-even', ROOT)).toEqual({
        npm_config_cafile: resolve(ROOT, './certs/ca.pem'),
      });
    });

    it('drops the whole file on an unquoted URL value', () => {
      // The `://` tokenizes into three tokens, which throws in yarn's parser and
      // costs the file every setting, not just the offending line. The YAML
      // retry loads it as one plain scalar, not a mapping, so it declares
      // nothing either (verified on 1.22.22: yarn resolves its own default).
      files[`${ROOT}/.yarnrc`] =
        'registry https://reg-a.example.com/\ncafile "./certs/ca.pem"\n';
      expect(getYarnClassicSpawnRegistryEnv('is-even', ROOT)).toEqual({});
    });

    it('honors a YAML-shaped file the lockfile parser rejects', () => {
      // The muscle memory .yarnrc.yml produces. Yarn's parser throws on the
      // `://`, the js-yaml retry accepts the file, and yarn honors every key in
      // it (verified on 1.22.22: `yarn config get registry` returns reg-a and
      // yarn goes on to open the cafile). Dropping it would send npm to the
      // default registry, which is the failure this bridging exists to prevent.
      files[`${ROOT}/.yarnrc`] = [
        'registry: https://reg-a.example.com/',
        'cafile: ./certs/ca.pem',
      ].join('\n');
      expect(getYarnClassicSpawnRegistryEnv('is-even', ROOT)).toEqual({
        npm_config_registry: 'https://reg-a.example.com/',
        npm_config_cafile: resolve(ROOT, './certs/ca.pem'),
      });
    });

    it('leaves a scalar the YAML retry loaded a string', () => {
      // The retry runs under the failsafe schema, where every scalar is a
      // string, and yarn Boolean()-coerces what it reads: `false` arrives
      // truthy and verification stays on. Typing it as a boolean here would
      // turn TLS verification off for npm where yarn leaves it on.
      files[`${ROOT}/.yarnrc`] = [
        'registry: https://reg-a.example.com/',
        'strict-ssl: false',
      ].join('\n');
      expect(getYarnClassicSpawnRegistryEnv('is-even', ROOT)).toEqual({
        npm_config_registry: 'https://reg-a.example.com/',
      });
    });

    it('drops the whole file when both parsers reject it', () => {
      files[`${ROOT}/.yarnrc`] = 'cafile "./certs/ca.pem"\n@@@ !!!\n';
      expect(getYarnClassicSpawnRegistryEnv('is-even', ROOT)).toEqual({});
    });

    it('drops the whole file on a duplicate key (classic passes no json flag)', () => {
      // berry's parser sets `json: true`, which makes a repeated key last-wins;
      // classic passes the schema alone, so js-yaml throws, the retry fails and
      // yarn itself dies on the file. Falling back to npm's own resolution is
      // the closest thing left to reproduce.
      files[`${ROOT}/.yarnrc`] = [
        'registry: https://reg-a.example.com/',
        'registry: https://reg-b.example.com/',
      ].join('\n');
      expect(getYarnClassicSpawnRegistryEnv('is-even', ROOT)).toEqual({});
    });

    it('keeps a trailing comment out of the value', () => {
      files[`${ROOT}/.yarnrc`] =
        'registry "https://reg-a.example.com/" # the mirror\n';
      expect(getYarnClassicSpawnRegistryEnv('is-even', ROOT)).toEqual({
        npm_config_registry: 'https://reg-a.example.com/',
      });
    });

    it('keeps the settings around a nested block', () => {
      files[`${ROOT}/.yarnrc`] = [
        'registry "https://reg-a.example.com/"',
        'nested:',
        '  inner "value"',
        'cafile "./certs/ca.pem"',
      ].join('\n');
      expect(getYarnClassicSpawnRegistryEnv('is-even', ROOT)).toEqual({
        npm_config_registry: 'https://reg-a.example.com/',
        npm_config_cafile: resolve(ROOT, './certs/ca.pem'),
      });
    });

    it('types a bare boolean but not a quoted one', () => {
      files[`${ROOT}/.yarnrc`] = 'strict-ssl false\n';
      expect(getYarnClassicSpawnRegistryEnv('is-even', ROOT)).toEqual({
        npm_config_strict_ssl: 'false',
      });
      files[`${ROOT}/.yarnrc`] = 'strict-ssl "false"\n';
      expect(getYarnClassicSpawnRegistryEnv('is-even', ROOT)).toEqual({});
    });
  });

  it('keeps a native nerf-darted token over a yarn-only bare one for the same registry', () => {
    // npm reads the project nerf-darted key itself; the ancestor bare token must
    // not shadow it via the env tier, matching yarn's registry-scoped-over-global
    // order.
    files[`${ROOT}/.npmrc`] = [
      'registry=https://reg-b.example.com/',
      '//reg-b.example.com/:_authToken=project-token',
    ].join('\n');
    files['/repo/.npmrc'] = [
      '_authToken=ancestor-token',
      'always-auth=true',
    ].join('\n');
    expect(getYarnClassicSpawnRegistryEnv('is-even', ROOT)).toEqual({});
  });

  describe('reporting a credential yarn would not send', () => {
    // The overlay cannot stop npm reading the same .npmrc, so npm authenticates
    // on a registry yarn resolved but would have queried anonymously.
    const warnFor = (packages: string[]): string[] => {
      const { logger } = require('../logger');
      (logger.warn as jest.Mock).mockClear();
      jest.isolateModules(() => {
        const {
          getYarnClassicSpawnRegistryEnv: fresh,
        } = require('./yarn-classic');
        for (const pkg of packages) {
          fresh(pkg, ROOT);
        }
      });
      return (logger.warn as jest.Mock).mock.calls.map((call) => call[0]);
    };

    beforeEach(() => {
      files[`${ROOT}/.yarnrc`] = 'registry "https://reg-y.example.com/"\n';
      files[`${ROOT}/.npmrc`] =
        '//reg-y.example.com/:_authToken=native-token\n';
    });

    it('warns once when npm authenticates on a bridged registry yarn would not', () => {
      const warnings = warnFor(['is-even', 'is-odd']);
      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toContain('//reg-y.example.com/');
      expect(warnings[0]).toContain('yarn would not send it');
    });

    it('stays quiet when always-auth makes yarn send the same credential', () => {
      files[`${ROOT}/.npmrc`] += 'always-auth=true\n';
      expect(warnFor(['is-even'])).toEqual([]);
    });

    it('stays quiet for a scoped fetch, which yarn authenticates', () => {
      expect(warnFor(['@acme/pkg'])).toEqual([]);
    });

    it('stays quiet when no registry was bridged', () => {
      // npm resolves this registry and this credential on its own, so it would
      // send the same header with or without the overlay.
      delete files[`${ROOT}/.yarnrc`];
      files[`${ROOT}/.npmrc`] =
        'registry=https://reg-y.example.com/\n//reg-y.example.com/:_authToken=native-token\n';
      expect(warnFor(['is-even'])).toEqual([]);
    });

    it('stays quiet when the credential sits in a file npm cannot read', () => {
      files[`${ROOT}/.npmrc`] = '';
      files['/repo/.npmrc'] =
        '//reg-y.example.com/:_authToken=ancestor-token\n';
      expect(warnFor(['is-even'])).toEqual([]);
    });

    it('follows npm up the registry path to a credential darted at the host', () => {
      files[`${ROOT}/.yarnrc`] =
        'registry "https://reg-y.example.com/artifactory/api/npm/repo/"\n';
      files[`${ROOT}/.npmrc`] =
        '//reg-y.example.com/:_authToken=native-token\n';
      expect(warnFor(['is-even'])).toHaveLength(1);
    });

    it.each([
      ['_auth', '//reg-y.example.com/:_auth=dXNlcjpwYXNz'],
      [
        'username and _password',
        '//reg-y.example.com/:username=user\n//reg-y.example.com/:_password=cGFzcw==',
      ],
    ])('recognizes a credential held as %s', (_form, npmrc) => {
      files[`${ROOT}/.npmrc`] = `${npmrc}\n`;
      expect(warnFor(['is-even'])).toHaveLength(1);
    });
  });
});
