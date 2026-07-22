// os.homedir() ignores a runtime process.env.HOME override under jest, and a
// spyOn does not affect a module's named import either; replace both modules so
// every resolver's home/ancestor lookup stays off the real filesystem.
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
  logger: {
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    log: jest.fn(),
    debug: jest.fn(),
    verbose: jest.fn(),
  },
}));

import * as fs from 'fs';
import { homedir } from 'os';
import { getNpmSpawnRegistryEnv } from './index';

describe('getNpmSpawnRegistryEnv (dispatch)', () => {
  const ROOT = '/repo/workspace';
  const HOME = '/home/user';
  let files: Record<string, string>;
  // Every env var any resolver consults, so the dispatch tests are stable on a
  // developer machine that happens to set one of them.
  const managedEnvKeys = [
    'npm_config_registry',
    'NPM_CONFIG_REGISTRY',
    'pnpm_config_registry',
    'PNPM_CONFIG_REGISTRY',
    'BUN_CONFIG_REGISTRY',
    'YARN_REGISTRY',
    'yarn_registry',
    'YARN_NPM_REGISTRY_SERVER',
    'YARN_NPM_AUTH_TOKEN',
    'YARN_NPM_AUTH_IDENT',
    'YARN_NPM_ALWAYS_AUTH',
    'YARN_RC_FILENAME',
    'YARN_ENABLE_STRICT_SSL',
    'YARN_HTTP_PROXY',
    'YARN_HTTPS_PROXY',
    'YARN_HTTPS_CA_FILE_PATH',
    'YARN_CA_FILE_PATH',
    'XDG_CONFIG_HOME',
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
  });

  afterEach(() => {
    for (const key of managedEnvKeys) {
      if (savedEnv[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = savedEnv[key];
      }
    }
  });

  it('returns nothing for npm (the spawned npm IS the package manager)', () => {
    files[`${ROOT}/.npmrc`] = 'registry=https://reg-a.example.com/';
    expect(getNpmSpawnRegistryEnv('is-even', ROOT, 'npm', '11.0.0')).toEqual(
      {}
    );
  });

  it('routes pnpm to the pnpm resolver', () => {
    files[`${ROOT}/pnpm-workspace.yaml`] =
      'registries:\n  default: https://reg-a.example.com/\n';
    expect(getNpmSpawnRegistryEnv('is-even', ROOT, 'pnpm', '11.5.0')).toEqual({
      npm_config_registry: 'https://reg-a.example.com/',
    });
  });

  it('returns nothing for pnpm when the version is unknown', () => {
    files[`${ROOT}/pnpm-workspace.yaml`] =
      'registries:\n  default: https://reg-a.example.com/\n';
    expect(getNpmSpawnRegistryEnv('is-even', ROOT, 'pnpm', null)).toEqual({});
  });

  it('returns nothing for yarn when the version is unknown', () => {
    files[`${ROOT}/.yarnrc.yml`] =
      'npmRegistryServer: https://reg-a.example.com/\n';
    expect(getNpmSpawnRegistryEnv('is-even', ROOT, 'yarn', null)).toEqual({});
  });

  it('warns once (not per package) when the yarn version is unknown', () => {
    // isolateModules gives a fresh index (the once-flag resets) but shares the
    // logger mock, so clear it first; the yarn-unknown branch returns before
    // touching the filesystem, so no file mocks are needed.
    const { logger } = require('../logger');
    (logger.warn as jest.Mock).mockClear();
    jest.isolateModules(() => {
      const { getNpmSpawnRegistryEnv: fresh } = require('./index');
      fresh('is-even', ROOT, 'yarn', null);
      fresh('is-odd', ROOT, 'yarn', null);
    });
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });

  it('warns once (not per package) when the pnpm version is unknown', () => {
    const { logger } = require('../logger');
    (logger.warn as jest.Mock).mockClear();
    jest.isolateModules(() => {
      const { getNpmSpawnRegistryEnv: fresh } = require('./index');
      fresh('is-even', ROOT, 'pnpm', null);
      fresh('is-odd', ROOT, 'pnpm', null);
    });
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });

  it('routes yarn 1.x to the classic resolver', () => {
    files[`${ROOT}/.yarnrc`] = 'registry "https://reg-a.example.com/"\n';
    expect(getNpmSpawnRegistryEnv('is-even', ROOT, 'yarn', '1.22.22')).toEqual({
      npm_config_registry: 'https://reg-a.example.com/',
    });
  });

  it('routes yarn >= 2 to the berry resolver (always injects)', () => {
    expect(getNpmSpawnRegistryEnv('is-even', ROOT, 'yarn', '4.16.0')).toEqual({
      npm_config_registry: 'https://registry.yarnpkg.com',
    });
  });

  it('routes bun to the bun resolver', () => {
    files[`${ROOT}/.npmrc`] = 'registry=https://reg-a.example.com/';
    expect(getNpmSpawnRegistryEnv('is-even', ROOT, 'bun', '1.2.23')).toEqual({
      npm_config_registry: 'https://reg-a.example.com/',
    });
  });

  it('degrades to no bridging when a resolver throws (root is not a string)', () => {
    const { logger } = require('../logger');
    (logger.verbose as jest.Mock).mockClear();
    expect(
      getNpmSpawnRegistryEnv('is-even', undefined as any, 'pnpm', '11.5.0')
    ).toEqual({});
    // Falling open is silent on stdout, so the cause has to stay recoverable.
    expect(logger.verbose).toHaveBeenCalledTimes(1);
  });

  it('warns once (not per package) that a configuration could not be read', () => {
    const { logger } = require('../logger');
    (logger.warn as jest.Mock).mockClear();
    files[`${ROOT}/.yarnrc.yml`] =
      'npmRegistryServer: "https://reg-a/\n  x: [\n';
    jest.isolateModules(() => {
      const { getNpmSpawnRegistryEnv: fresh } = require('./index');
      fresh('is-even', ROOT, 'yarn', '4.16.0');
      fresh('is-odd', ROOT, 'yarn', '4.16.0');
    });
    // Verbose is off by default, so a workspace nx knows is misconfigured would
    // otherwise fall back to npm's own resolution with no output at all.
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect((logger.warn as jest.Mock).mock.calls[0][0]).toContain(
      'Could not read the yarn configuration'
    );
  });

  it('degrades to no bridging when a yarn rc file does not parse', () => {
    const { logger } = require('../logger');
    (logger.verbose as jest.Mock).mockClear();
    files[`${ROOT}/.yarnrc.yml`] =
      'npmRegistryServer: "https://reg-a.example.com/\n  bad: [unclosed\n';
    files[`${HOME}/.yarnrc.yml`] = 'npmAuthToken: home-token\n';
    // Not the yarnpkg default plus the home token, which is where skipping the
    // unreadable file would have sent the credential.
    expect(getNpmSpawnRegistryEnv('@acme/pkg', ROOT, 'yarn', '4.16.0')).toEqual(
      {}
    );
    expect(logger.verbose).toHaveBeenCalledTimes(1);
  });

  it('points the default registry at a bridged scoped registry for an underscore scope', () => {
    // npm normalizes the @my_scope:registry env key to @my-scope:registry but
    // looks it up verbatim, so the scoped override is lost; the view/pack target
    // is this exact package, so the default must carry the scoped registry.
    files[`${ROOT}/bunfig.toml`] =
      '[install.scopes]\n"@my_scope" = "https://reg-underscore.example.com/"\n';
    expect(
      getNpmSpawnRegistryEnv('@my_scope/pkg', ROOT, 'bun', '1.2.23')
    ).toEqual({
      npm_config_registry: 'https://reg-underscore.example.com/',
      'npm_config_@my_scope:registry': 'https://reg-underscore.example.com/',
    });
  });

  it('does not override the default registry for a normal lowercase scope', () => {
    files[`${ROOT}/bunfig.toml`] = [
      '[install]',
      'registry = "https://reg-a.example.com/"',
      '[install.scopes]',
      '"@myorg" = "https://reg-b.example.com/"',
    ].join('\n');
    expect(getNpmSpawnRegistryEnv('@myorg/pkg', ROOT, 'bun', '1.2.23')).toEqual(
      {
        npm_config_registry: 'https://reg-a.example.com/',
        'npm_config_@myorg:registry': 'https://reg-b.example.com/',
      }
    );
  });
});
