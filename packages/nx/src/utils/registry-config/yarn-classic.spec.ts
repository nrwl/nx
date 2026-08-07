// os.homedir() ignores a runtime process.env.HOME override under jest, and a
// spyOn does not reach a module's named import either.
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
import { dirname, join, resolve } from 'path';
import { getYarnClassicSpawnRegistryEnv } from './yarn-classic';

describe('getYarnClassicSpawnRegistryEnv', () => {
  const ROOT = '/repo/workspace';
  const HOME = '/home/user';
  const PREFIX = '/prefix';
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
    'DESTDIR',
    'FAKEROOTKEY',
    // yarn names its CLI-rc paths off these rather than off os.homedir().
    'HOME',
    'USERPROFILE',
    'YARN_CONFIG',
    'XDG_CONFIG_HOME',
    'LOCALAPPDATA',
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
    process.env.PREFIX = PREFIX;
    process.env.HOME = HOME;
    process.env.USERPROFILE = HOME;
    // Deleting FAKEROOTKEY above puts production on its root home tier whenever
    // the run itself is uid 0 (container CI).
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

  it('bridges a BOM-prefixed project .yarnrc (yarn strips the BOM)', () => {
    files[`${ROOT}/.yarnrc`] = '\uFEFFregistry "https://reg-a.example.com/"\n';
    expect(getYarnClassicSpawnRegistryEnv('is-even', ROOT)).toEqual({
      npm_config_registry: 'https://reg-a.example.com/',
    });
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

  it('falls through an empty PREFIX to the executable prefix, the way yarn does', () => {
    // yarn reads PREFIX for truthiness, so an exported but empty one leaves the
    // etc tier on process.execPath. Reading it as set resolves a bare `etc`
    // against the cwd, which opens a file yarn never looks at.
    process.env.PREFIX = '';
    files[join(dirname(dirname(process.execPath)), 'etc', 'yarnrc')] =
      'registry "https://reg-etc.example.com/"\n';
    expect(getYarnClassicSpawnRegistryEnv('is-even', ROOT)).toEqual({
      npm_config_registry: 'https://reg-etc.example.com/',
    });
  });

  (process.platform === 'win32' ? it.skip : it)(
    'reroots the etc tier through DESTDIR, which yarn honors on Unix only',
    () => {
      // yarn joins DESTDIR onto the executable prefix, and only once PREFIX has
      // not answered.
      delete process.env.PREFIX;
      process.env.DESTDIR = '/staged';
      files[
        join('/staged', dirname(dirname(process.execPath)), 'etc', 'yarnrc')
      ] = 'registry "https://reg-etc.example.com/"\n';
      expect(getYarnClassicSpawnRegistryEnv('is-even', ROOT)).toEqual({
        npm_config_registry: 'https://reg-etc.example.com/',
      });
    }
  );

  it('lets <prefix>/etc/npmrc (npm-native) shadow an ancestor .npmrc without bridging', () => {
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

  // yarn names far more CLI-rc paths than the tiers its registry client reads.
  // A miss here bridges the project .yarnrc that yarn itself overrode.
  it.each([
    ['~/.config/yarn/config', `${HOME}/.config/yarn/config`],
    ['~/.yarn/config', `${HOME}/.yarn/config`],
    ['the XDG config dir', '/xdg/yarn'],
    ['$YARN_CONFIG', '/env/rc'],
    ['/etc/yarnrc', '/etc/yarnrc'],
    ['/etc/yarn/config', '/etc/yarn/config'],
    ['a home .yarnrc.yml', `${HOME}/.yarnrc.yml`],
    ['a project .yarnrc.yml', `${ROOT}/.yarnrc.yml`],
  ])('bridges a --registry CLI line in %s', (_label, path) => {
    process.env.XDG_CONFIG_HOME = '/xdg';
    process.env.YARN_CONFIG = '/env/rc';
    files[`${ROOT}/.yarnrc`] = 'registry "https://reg-proj.example.com/"\n';
    files[path] = path.endsWith('.yml')
      ? '"--registry": "https://reg-cli.example.com/"\n'
      : '--registry "https://reg-cli.example.com/"\n';
    expect(getYarnClassicSpawnRegistryEnv('is-even', ROOT)).toEqual({
      npm_config_registry: 'https://reg-cli.example.com/',
    });
  });

  it('fails when ~/.config/yarn is a file, since its sibling rc path then runs through a non-directory', () => {
    // yarn names both ~/.config/yarn and ~/.config/yarn/config, so a file at
    // the first turns the second into an ENOTDIR and the tier can never
    // contribute a registry (measured on 1.22.22: exit 1 whatever it says,
    // with and without XDG_CONFIG_HOME).
    files[`${ROOT}/.yarnrc`] = 'registry "https://reg-proj.example.com/"\n';
    files[`${HOME}/.config/yarn`] =
      '--registry "https://reg-cli.example.com/"\n';
    const readFile = (fs.readFileSync as jest.Mock).getMockImplementation();
    (fs.readFileSync as jest.Mock).mockImplementation(
      (p: any, ...rest: any[]) => {
        if (p === `${HOME}/.config/yarn/config`) {
          throw Object.assign(new Error(`ENOTDIR: ${p}`), { code: 'ENOTDIR' });
        }
        return readFile(p, ...rest);
      }
    );
    expect(() => getYarnClassicSpawnRegistryEnv('is-even', ROOT)).toThrow(
      /yarn config at .* could not be read/
    );
  });

  it('drops every CLI-rc home path when the home env var is unset', () => {
    delete process.env.HOME;
    delete process.env.USERPROFILE;
    files[`${HOME}/.yarnrc`] = '--registry "https://reg-home.example.com/"\n';
    files[`${ROOT}/.yarnrc`] = 'registry "https://reg-proj.example.com/"\n';
    expect(getYarnClassicSpawnRegistryEnv('is-even', ROOT)).toEqual({
      npm_config_registry: 'https://reg-proj.example.com/',
    });
  });

  it('lets a .yarnrc.yml beat the .yarnrc beside it', () => {
    files[`${ROOT}/.yarnrc.yml`] =
      '"--registry": "https://reg-yml.example.com/"\n';
    files[`${ROOT}/.yarnrc`] = '--registry "https://reg-cli.example.com/"\n';
    expect(getYarnClassicSpawnRegistryEnv('is-even', ROOT)).toEqual({
      npm_config_registry: 'https://reg-yml.example.com/',
    });
  });

  it('lets $YARN_CONFIG beat the home .yarnrc', () => {
    process.env.YARN_CONFIG = '/env/rc';
    files['/env/rc'] = '--registry "https://reg-env.example.com/"\n';
    files[`${HOME}/.yarnrc`] = '--registry "https://reg-home.example.com/"\n';
    expect(getYarnClassicSpawnRegistryEnv('is-even', ROOT)).toEqual({
      npm_config_registry: 'https://reg-env.example.com/',
    });
  });

  it('ignores a .yarnrc.yml CLI line that is not a mapping', () => {
    files[`${ROOT}/.yarnrc.yml`] =
      '--registry "https://reg-yml.example.com/"\n';
    files[`${ROOT}/.yarnrc`] = 'registry "https://reg-proj.example.com/"\n';
    expect(getYarnClassicSpawnRegistryEnv('is-even', ROOT)).toEqual({
      npm_config_registry: 'https://reg-proj.example.com/',
    });
  });

  it('drops a .yarnrc.yml CLI line when the file names a yarn-path', () => {
    files[`${ROOT}/.yarnrc.yml`] = [
      '"--registry": "https://reg-yml.example.com/"',
      'yarnPath: ./.yarn/releases/yarn.cjs',
    ].join('\n');
    files[`${ROOT}/.yarnrc`] = 'registry "https://reg-proj.example.com/"\n';
    expect(getYarnClassicSpawnRegistryEnv('is-even', ROOT)).toEqual({
      npm_config_registry: 'https://reg-proj.example.com/',
    });
  });

  describe('on Windows', () => {
    // yarn names its CLI-rc home paths off USERPROFILE there, drops the /etc
    // tiers, and resolves its config dir through LOCALAPPDATA. Nx has no
    // Windows CI job, so driving the platform here is the only coverage these
    // arms get.
    const originalPlatform = Object.getOwnPropertyDescriptor(
      process,
      'platform'
    )!;
    const USERHOME = 'C:\\Users\\me';
    const APPDATA = 'C:\\Users\\me\\AppData\\Local';

    beforeEach(() => {
      Object.defineProperty(process, 'platform', { value: 'win32' });
      process.env.USERPROFILE = USERHOME;
      // Distinct from both, so anything reading it is visible.
      process.env.HOME = '/posix/home';
    });

    afterEach(() => {
      Object.defineProperty(process, 'platform', originalPlatform);
    });

    it('names its CLI-rc home paths off USERPROFILE, not HOME', () => {
      files['/posix/home/.yarnrc'] =
        '--registry "https://reg-posix.example.com/"\n';
      files[join(USERHOME, '.yarnrc')] =
        '--registry "https://reg-user.example.com/"\n';
      expect(getYarnClassicSpawnRegistryEnv('is-even', ROOT)).toEqual({
        npm_config_registry: 'https://reg-user.example.com/',
      });
    });

    it('resolves the config dir through LOCALAPPDATA', () => {
      // The other arm, LOCALAPPDATA unset, cannot be observed: it returns
      // <home>/.config/yarn, and USERPROFILE is both what os.homedir() reports
      // on Windows and what already puts that path in the list.
      process.env.LOCALAPPDATA = APPDATA;
      files[`${ROOT}/.yarnrc`] = 'registry "https://reg-proj.example.com/"\n';
      files[join(APPDATA, 'Yarn', 'Config')] =
        '--registry "https://reg-appdata.example.com/"\n';
      expect(getYarnClassicSpawnRegistryEnv('is-even', ROOT)).toEqual({
        npm_config_registry: 'https://reg-appdata.example.com/',
      });
    });

    it('never reads the /etc tiers', () => {
      files['/etc/yarnrc'] = '--registry "https://reg-etc.example.com/"\n';
      files['/etc/yarn/config'] =
        '--registry "https://reg-etcdir.example.com/"\n';
      files[`${ROOT}/.yarnrc`] = 'registry "https://reg-proj.example.com/"\n';
      expect(getYarnClassicSpawnRegistryEnv('is-even', ROOT)).toEqual({
        npm_config_registry: 'https://reg-proj.example.com/',
      });
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

  it('bridges an unscoped registry auth token when a bare always-auth flag is set', () => {
    // ini reads a valueless `always-auth` as true, so yarn authenticates the
    // unscoped fetch.
    files['/repo/.npmrc'] = [
      'registry=https://reg-d.example.com/',
      '//reg-d.example.com/:_authToken=ancestor-token',
      'always-auth',
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
    // always-auth comes from NpmRegistry's config, which loadConfig fills from
    // the npmrc chain alone.
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
    // every read is flat, so only a dot-free registry-scoped key reaches yarn.
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
    // objectPath nests this key under `//reg-d`, so yarn's flat read never sees
    // it.
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
    // yarn's getRegistryOrGlobalOption ORs the two tiers.
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
    files[`${ROOT}/.npmrc`] = [
      'registry=https://reg-b.example.com/',
      '//reg-b.example.com/:_authToken=project-token',
    ].join('\n');
    expect(getYarnClassicSpawnRegistryEnv('is-even', ROOT)).toEqual({});
  });

  it('bridges a yarn-only auth token for a scoped fetch even without always-auth', () => {
    // npm reads the project .npmrc itself, so its scoped registry needs no
    // bridge.
    files[`${ROOT}/.npmrc`] = '@types:registry=https://reg-b.example.com/';
    files['/repo/.npmrc'] = '//reg-b.example.com/:_authToken=ancestor-token';
    expect(getYarnClassicSpawnRegistryEnv('@types/node', ROOT)).toEqual({
      'npm_config_//reg-b.example.com/:_authToken': 'ancestor-token',
    });
  });

  it('expands ${VAR} in a yarn-only ancestor .npmrc auth token before bridging', () => {
    // yarn classic env-replaces .npmrc values, so the bridged token carries the
    // secret yarn resolved.
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
    // With no registry configured the spawned npm queries its own default, so
    // the creds dart onto npmjs rather than yarn's default.
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
    // yarn's getRegistryOrGlobalOption takes the registry-scoped key first.
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
    // npm reads this file itself: the registry does not bridge, and npm refuses
    // to run on the bare key it finds there (ERR_INVALID_AUTH), so the re-keyed
    // dart entry is produced but never consumed from this source. The case pins
    // the dart routing shared with the yarn-only sources that do consume it.
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

    it('outranks npm_config_cafile', () => {
      // YarnRegistry.getOption reads yarn's own config before npm's.
      process.env.npm_config_cafile = './certs/npm-ca.pem';
      process.env.YARN_CAFILE = './certs/env-ca.pem';
      expect(getYarnClassicSpawnRegistryEnv('is-even', ROOT)).toEqual({
        npm_config_cafile: resolve(ROOT, './certs/env-ca.pem'),
      });
    });

    it('defers to npm_config_cafile below the .yarnrc tier', () => {
      // Yarn declares no cafile of its own, so it falls through to npm's
      // config, where the env tier npm reads itself shadows the ancestor
      // .npmrc.
      files['/repo/.npmrc'] = 'cafile=./certs/ancestor-ca.pem';
      process.env.npm_config_cafile = './certs/npm-ca.pem';
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

  it('keeps TLS verification on for npm where an .npmrc would turn it off', () => {
    // yarn's DEFAULTS carry strict-ssl, so getOption never reaches npm's config
    // and this .npmrc cannot turn verification off for yarn.
    files[`${ROOT}/.npmrc`] = 'strict-ssl=false';
    files[`${ROOT}/.yarnrc`] = 'strict-ssl true\n';
    expect(getYarnClassicSpawnRegistryEnv('is-even', ROOT)).toEqual({
      npm_config_strict_ssl: 'true',
    });
  });

  it('does not restate a strict-ssl npm already resolves the same way', () => {
    files[`${ROOT}/.yarnrc`] = 'strict-ssl true\n';
    expect(getYarnClassicSpawnRegistryEnv('is-even', ROOT)).toEqual({});
  });

  it('does not bridge a strict-ssl that only an .npmrc declares', () => {
    // No .npmrc feeds yarn's strict-ssl, so bridging this one would turn
    // verification off for npm where yarn keeps it on.
    files['/repo/.npmrc'] = 'strict-ssl=false';
    expect(getYarnClassicSpawnRegistryEnv('is-even', ROOT)).toEqual({});
  });

  it('authenticates an unscoped fetch on a registry-scoped always-auth', () => {
    // always-auth is read for the registry being queried, not for the key the
    // credential came from, so the bare global token is sent.
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
      // The `://` splits into three tokens, so yarn's parser throws and the
      // retry loads the file as one scalar, not a mapping, which declares
      // nothing.
      files[`${ROOT}/.yarnrc`] =
        'registry https://reg-a.example.com/\ncafile "./certs/ca.pem"\n';
      expect(getYarnClassicSpawnRegistryEnv('is-even', ROOT)).toEqual({});
    });

    it('honors a YAML-shaped file the lockfile parser rejects', () => {
      // Berry habits put YAML in a classic .yarnrc, and the retry accepts it,
      // so yarn honors every key (verified on 1.22.22).
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
      // The retry's failsafe schema makes every scalar a string, and yarn
      // Boolean()-coerces it, so this `false` stays truthy and verification
      // stays on.
      files[`${ROOT}/.yarnrc`] = [
        'registry: https://reg-a.example.com/',
        'strict-ssl: false',
      ].join('\n');
      expect(getYarnClassicSpawnRegistryEnv('is-even', ROOT)).toEqual({
        npm_config_registry: 'https://reg-a.example.com/',
      });
    });

    it('reads a file the retry loads as one scalar as declaring nothing', () => {
      files[`${ROOT}/.yarnrc`] = 'cafile "./certs/ca.pem"\n@@@ !!!\n';
      expect(getYarnClassicSpawnRegistryEnv('is-even', ROOT)).toEqual({});
    });

    it('fails on a duplicate key (classic passes no json flag)', () => {
      // classic passes js-yaml the schema alone (berry adds `json: true`, which
      // makes a repeated key last-wins), so yarn rethrows and exits 1 on this
      // file.
      files[`${ROOT}/.yarnrc`] = [
        'registry: https://reg-a.example.com/',
        'registry: https://reg-b.example.com/',
      ].join('\n');
      expect(() => getYarnClassicSpawnRegistryEnv('is-even', ROOT)).toThrow(
        /yarn config at .* could not be read/
      );
    });

    it('fails on a .yarnrc that cannot be opened', () => {
      // yarn propagates the EACCES and exits 1 (verified on 1.22.22), so there
      // is no resolution left to reproduce.
      files[`${ROOT}/.yarnrc`] = 'registry "https://reg-a.example.com/"\n';
      const readFile = (fs.readFileSync as jest.Mock).getMockImplementation();
      (fs.readFileSync as jest.Mock).mockImplementation(
        (p: any, ...rest: any[]) => {
          if (p === `${ROOT}/.yarnrc`) {
            throw Object.assign(new Error(`EACCES: ${p}`), { code: 'EACCES' });
          }
          return readFile(p, ...rest);
        }
      );
      expect(() => getYarnClassicSpawnRegistryEnv('is-even', ROOT)).toThrow(
        /yarn config at .* could not be read/
      );
    });

    it.each(['ELOOP', 'ENOTDIR'])(
      'fails on a .yarnrc %s that a preceding existence check would call absent',
      (code) => {
        // yarn's ungated pass over this file exits 1 on both (verified on
        // 1.22.22). Skipping it would silently land the workspace on the home
        // registry below it.
        files[`${HOME}/.yarnrc`] = 'registry "https://reg-home.example.com/"\n';
        const readFile = (fs.readFileSync as jest.Mock).getMockImplementation();
        (fs.readFileSync as jest.Mock).mockImplementation(
          (p: any, ...rest: any[]) => {
            if (p === `${ROOT}/.yarnrc`) {
              throw Object.assign(new Error(`${code}: ${p}`), { code });
            }
            return readFile(p, ...rest);
          }
        );
        expect(() => getYarnClassicSpawnRegistryEnv('is-even', ROOT)).toThrow(
          /yarn config at .* could not be read/
        );
      }
    );

    it('looks past an .npmrc in the chain that yarn never finds', () => {
      // Nothing reads .npmrc a second time ungated, so a symlink loop stays
      // absent here where the same fault on .yarnrc aborts yarn (exit 0 vs 1 on
      // 1.22.22). The lookup is what spares it, and the read fault below is
      // what it is spared from: drop the existence check and this goes red.
      files[`${HOME}/.yarnrc`] = 'registry "https://reg-home.example.com/"\n';
      const readFile = (fs.readFileSync as jest.Mock).getMockImplementation();
      (fs.readFileSync as jest.Mock).mockImplementation(
        (p: any, ...rest: any[]) => {
          if (p === `${ROOT}/.npmrc`) {
            throw Object.assign(new Error(`ELOOP: ${p}`), { code: 'ELOOP' });
          }
          return readFile(p, ...rest);
        }
      );
      expect(getYarnClassicSpawnRegistryEnv('is-even', ROOT)).toEqual({
        npm_config_registry: 'https://reg-home.example.com/',
      });
    });

    it('looks past a <prefix>/etc/yarnrc that yarn never finds', () => {
      // Only the CLI-rc tiers get the second ungated read, so this one is
      // absent where the same fault on the project .yarnrc aborts yarn
      // (verified on 1.22.22: exit 0 here, exit 1 there). Every fault that
      // reaches this tier fails its lookup first, so one stands for all of
      // them; the read fault below is what the lookup spares it from.
      files[`${HOME}/.yarnrc`] = 'registry "https://reg-home.example.com/"\n';
      const readFile = (fs.readFileSync as jest.Mock).getMockImplementation();
      (fs.readFileSync as jest.Mock).mockImplementation(
        (p: any, ...rest: any[]) => {
          if (p === `${PREFIX}/etc/yarnrc`) {
            throw Object.assign(new Error(`ELOOP: ${p}`), { code: 'ELOOP' });
          }
          return readFile(p, ...rest);
        }
      );
      expect(getYarnClassicSpawnRegistryEnv('is-even', ROOT)).toEqual({
        npm_config_registry: 'https://reg-home.example.com/',
      });
    });

    it('looks past a directory at a CLI-rc-only path', () => {
      // Nothing looks this one up, so the ungated pass is the only reader and
      // it spares EISDIR outright (verified on 1.22.22: exit 0, where the same
      // directory at the project .yarnrc exits 1).
      files[`${ROOT}/.yarnrc`] = 'registry "https://reg-proj.example.com/"\n';
      const readFile = (fs.readFileSync as jest.Mock).getMockImplementation();
      (fs.readFileSync as jest.Mock).mockImplementation(
        (p: any, ...rest: any[]) => {
          if (p === `${HOME}/.config/yarn/config`) {
            throw Object.assign(new Error(`EISDIR: ${p}`), { code: 'EISDIR' });
          }
          return readFile(p, ...rest);
        }
      );
      expect(getYarnClassicSpawnRegistryEnv('is-even', ROOT)).toEqual({
        npm_config_registry: 'https://reg-proj.example.com/',
      });
    });

    it('fails on a CLI-rc-only path that cannot be opened', () => {
      // The ungated pass spares ENOENT and EISDIR alone, rethrowing the rest
      // (verified on 1.22.22: exit 1 naming the EACCES).
      files[`${ROOT}/.yarnrc`] = 'registry "https://reg-proj.example.com/"\n';
      const readFile = (fs.readFileSync as jest.Mock).getMockImplementation();
      (fs.readFileSync as jest.Mock).mockImplementation(
        (p: any, ...rest: any[]) => {
          if (p === `${HOME}/.config/yarn/config`) {
            throw Object.assign(new Error(`EACCES: ${p}`), { code: 'EACCES' });
          }
          return readFile(p, ...rest);
        }
      );
      expect(() => getYarnClassicSpawnRegistryEnv('is-even', ROOT)).toThrow(
        /yarn config at .* could not be read/
      );
    });

    it('fails on a directory at a .yarnrc the registry client also reads', () => {
      // The lookup passes on a directory and the open behind it dies, so this
      // one keeps no EISDIR tolerance (verified on 1.22.22: exit 1).
      files[`${HOME}/.yarnrc`] = 'registry "https://reg-home.example.com/"\n';
      const readFile = (fs.readFileSync as jest.Mock).getMockImplementation();
      (fs.readFileSync as jest.Mock).mockImplementation(
        (p: any, ...rest: any[]) => {
          if (p === `${ROOT}/.yarnrc`) {
            throw Object.assign(new Error(`EISDIR: ${p}`), { code: 'EISDIR' });
          }
          return readFile(p, ...rest);
        }
      );
      expect(() => getYarnClassicSpawnRegistryEnv('is-even', ROOT)).toThrow(
        /yarn config at .* could not be read/
      );
    });

    it('fails on a <prefix>/etc/yarnrc that yarn finds and cannot open', () => {
      // The lookup succeeds here, so yarn opens it and exits 1 (verified on
      // 1.22.22 for both a directory and an unreadable file).
      files[`${PREFIX}/etc/yarnrc`] =
        'registry "https://reg-etc.example.com/"\n';
      const readFile = (fs.readFileSync as jest.Mock).getMockImplementation();
      (fs.readFileSync as jest.Mock).mockImplementation(
        (p: any, ...rest: any[]) => {
          if (p === `${PREFIX}/etc/yarnrc`) {
            throw Object.assign(new Error(`EACCES: ${p}`), { code: 'EACCES' });
          }
          return readFile(p, ...rest);
        }
      );
      expect(() => getYarnClassicSpawnRegistryEnv('is-even', ROOT)).toThrow(
        /yarn config at .* could not be read/
      );
    });

    it('fails on an .npmrc in the chain that cannot be opened', () => {
      // yarn dies the same way on its .npmrc chain (verified on 1.22.22: EACCES
      // on the workspace .npmrc fails both config get and install).
      files[`${ROOT}/.npmrc`] = 'registry=https://reg-a.example.com/';
      const readFile = (fs.readFileSync as jest.Mock).getMockImplementation();
      (fs.readFileSync as jest.Mock).mockImplementation(
        (p: any, ...rest: any[]) => {
          if (p === `${ROOT}/.npmrc`) {
            throw Object.assign(new Error(`EACCES: ${p}`), { code: 'EACCES' });
          }
          return readFile(p, ...rest);
        }
      );
      expect(() => getYarnClassicSpawnRegistryEnv('is-even', ROOT)).toThrow(
        /\.npmrc at .* could not be read/
      );
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

  describe('env references, which yarn expands with a grammar of its own', () => {
    const ANCESTOR = dirname(ROOT);

    beforeEach(() => {
      process.env.YC_TEST_TOKEN = 'yc-token';
    });
    afterEach(() => {
      delete process.env.YC_TEST_TOKEN;
      delete process.env.YC_TEST_EMPTY;
    });

    it('expands one in an .npmrc only yarn reads', () => {
      files[`${ANCESTOR}/.npmrc`] =
        '//reg-a.example.com/:_authToken=${YC_TEST_TOKEN}\nalways-auth=true\nregistry=https://reg-a.example.com/\n';
      expect(getYarnClassicSpawnRegistryEnv('is-even', ROOT)).toEqual({
        npm_config_registry: 'https://reg-a.example.com/',
        'npm_config_//reg-a.example.com/:_authToken': 'yc-token',
      });
    });

    it('keeps every backslash of an odd run, unlike npm, and escapes it back', () => {
      // yarn returns the whole match for an odd run, backslash included, so the
      // credential it sends carries one. npm halves the run it receives, which
      // is what the escape here is sized for.
      files[`${ANCESTOR}/.npmrc`] =
        '//reg-a.example.com/:_authToken=\\${YC_TEST_TOKEN}\nalways-auth=true\nregistry=https://reg-a.example.com/\n';
      expect(getYarnClassicSpawnRegistryEnv('is-even', ROOT)).toEqual({
        npm_config_registry: 'https://reg-a.example.com/',
        'npm_config_//reg-a.example.com/:_authToken': '\\\\\\${YC_TEST_TOKEN}',
      });
    });

    it('drops every backslash of an even run, where npm keeps half', () => {
      // Four in the file, since the ini reader in front of yarn's replacer
      // halves them before it ever sees the run.
      files[`${ANCESTOR}/.npmrc`] =
        '//reg-a.example.com/:_authToken=\\\\\\\\${YC_TEST_TOKEN}\nalways-auth=true\nregistry=https://reg-a.example.com/\n';
      expect(getYarnClassicSpawnRegistryEnv('is-even', ROOT)).toEqual({
        npm_config_registry: 'https://reg-a.example.com/',
        'npm_config_//reg-a.example.com/:_authToken': 'yc-token',
      });
    });

    it('falls open on one it resolves nothing for, the way yarn aborts', () => {
      files[`${ANCESTOR}/.npmrc`] = 'registry=https://${YC_TEST_UNSET}/\n';
      expect(() => getYarnClassicSpawnRegistryEnv('is-even', ROOT)).toThrow(
        /Failed to replace env in config/
      );
    });

    it('escapes one in a .yarnrc, which yarn never expands at all', () => {
      files[`${ANCESTOR}/.yarnrc`] = 'registry "https://${YC_TEST_TOKEN}/"\n';
      expect(getYarnClassicSpawnRegistryEnv('is-even', ROOT)).toEqual({
        npm_config_registry: 'https://\\${YC_TEST_TOKEN}/',
      });
    });
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
      // Classic reads the same file and sends that credential for every scoped
      // package, so telling the user to delete it would break yarn install.
      expect(warnings[0]).toContain('yarn does send it for scoped packages');
      expect(warnings[0]).not.toContain('Remove that credential');
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
