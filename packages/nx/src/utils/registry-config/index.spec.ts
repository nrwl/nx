// Under jest, os.homedir() ignores a process.env.HOME override and a spyOn does
// not reach a module's named import; mock both to stay off the real filesystem.
jest.mock('os', () => ({
  ...jest.requireActual('os'),
  homedir: jest.fn(() => '/home/user'),
}));
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  existsSync: jest.fn(),
  readFileSync: jest.fn(),
  statSync: jest.fn(),
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
import { getNpmSpawnRegistryEnv, ignoresNpmConfigEnv } from './index';

describe('getNpmSpawnRegistryEnv (dispatch)', () => {
  const ROOT = '/repo/workspace';
  const HOME = '/home/user';
  let files: Record<string, string>;
  // Cleared so a developer machine that sets one of these cannot change what
  // the dispatch tests resolve.
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
    // Every path in this fixture is a file, which is what pnpm's pre-11.8.0
    // lookup asks about.
    (fs.statSync as jest.Mock).mockImplementation((p: any) => {
      if (typeof p === 'string' && p in files) {
        return { isFile: () => true, isDirectory: () => false };
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
    // isolateModules resets the once-flag but shares the logger mock, so clear
    // it first; this branch returns before touching the filesystem, so no file
    // fixtures.
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
    expect(logger.verbose).toHaveBeenCalledTimes(1);
  });

  it('warns once (not per package) that a configuration could not be resolved', () => {
    const { logger } = require('../logger');
    (logger.warn as jest.Mock).mockClear();
    files[`${ROOT}/.yarnrc.yml`] =
      'npmRegistryServer: "https://reg-a/\n  x: [\n';
    jest.isolateModules(() => {
      const { getNpmSpawnRegistryEnv: fresh } = require('./index');
      fresh('is-even', ROOT, 'yarn', '4.16.0');
      fresh('is-odd', ROOT, 'yarn', '4.16.0');
    });
    // Verbose is off by default, so without this warning the fallback to npm's
    // own resolution is silent.
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect((logger.warn as jest.Mock).mock.calls[0][0]).toContain(
      'Could not resolve the yarn configuration'
    );
  });

  it('degrades to no bridging when the pnpm global config.yaml does not parse (pnpm dies on it)', () => {
    const { logger } = require('../logger');
    (logger.warn as jest.Mock).mockClear();
    process.env.XDG_CONFIG_HOME = '/xdg';
    files['/xdg/pnpm/config.yaml'] = '_auth: [unclosed\n';
    jest.isolateModules(() => {
      const { getNpmSpawnRegistryEnv: fresh } = require('./index');
      expect(fresh('is-even', ROOT, 'pnpm', '11.10.0')).toEqual({});
    });
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect((logger.warn as jest.Mock).mock.calls[0][0]).toContain(
      'Could not resolve the pnpm configuration'
    );
  });

  it('degrades to no bridging when a yarn rc file does not parse', () => {
    const { logger } = require('../logger');
    (logger.verbose as jest.Mock).mockClear();
    files[`${ROOT}/.yarnrc.yml`] =
      'npmRegistryServer: "https://reg-a.example.com/\n  bad: [unclosed\n';
    files[`${HOME}/.yarnrc.yml`] = 'npmAuthToken: home-token\n';
    // Skipping the unparsable file would have sent the home token to the
    // yarnpkg default.
    expect(getNpmSpawnRegistryEnv('@acme/pkg', ROOT, 'yarn', '4.16.0')).toEqual(
      {}
    );
    expect(logger.verbose).toHaveBeenCalledTimes(1);
  });

  it('degrades to no bridging when yarn classic hits an unreadable .npmrc (yarn itself dies on it)', () => {
    const { logger } = require('../logger');
    (logger.warn as jest.Mock).mockClear();
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
    // yarn itself exits 1 on the unreadable file, so resolving from the rest
    // would promote a registry it never reaches. isolateModules keeps the
    // warn-once flag fresh.
    jest.isolateModules(() => {
      const { getNpmSpawnRegistryEnv: fresh } = require('./index');
      expect(fresh('is-even', ROOT, 'yarn', '1.22.22')).toEqual({});
    });
    expect((logger.warn as jest.Mock).mock.calls[0][0]).toContain(
      'Could not resolve the yarn configuration'
    );
  });

  it('points the default registry at a bridged scoped registry for an underscore scope', () => {
    // npm rewrites @my_scope to @my-scope but looks the key up verbatim, so the
    // scoped override alone would be lost; the target is this exact package.
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

describe('ignoresNpmConfigEnv', () => {
  it('reports npm and bun as reading the env tier', () => {
    expect(ignoresNpmConfigEnv('npm', '11.16.0')('registry')).toBe(false);
    expect(ignoresNpmConfigEnv('bun', '1.3.13')('registry')).toBe(false);
  });

  it('reports pnpm as ignoring it from 11.0.0 on', () => {
    // 11.0.0 moved pnpm off npm_config_* onto its own PNPM_CONFIG_* prefix.
    expect(ignoresNpmConfigEnv('pnpm', '10.15.0')('registry')).toBe(false);
    expect(ignoresNpmConfigEnv('pnpm', '11.0.0')('registry')).toBe(true);
    expect(ignoresNpmConfigEnv('pnpm', '11.9.0')('registry')).toBe(true);
  });

  it('reports pnpm as reading a URL-scoped key again from 11.6.0 on', () => {
    // 11.6.0 added readUrlScopedEnvConfig: `npm_config_//<dart>:<key>` entries
    // are read from the environment, except `:tokenHelper`.
    const dartKey = '//reg.example.com/:_authToken';
    expect(ignoresNpmConfigEnv('pnpm', '11.5.0')(dartKey)).toBe(true);
    expect(ignoresNpmConfigEnv('pnpm', '11.6.0')(dartKey)).toBe(false);
    expect(ignoresNpmConfigEnv('pnpm', '11.9.0')(dartKey)).toBe(false);
    expect(
      ignoresNpmConfigEnv('pnpm', '11.6.0')('//reg.example.com/:tokenHelper')
    ).toBe(true);
    expect(ignoresNpmConfigEnv('pnpm', '11.6.0')('registry')).toBe(true);
    expect(ignoresNpmConfigEnv('pnpm', '11.6.0')('@myorg:registry')).toBe(true);
  });

  it('reports yarn berry as ignoring it, classic as reading it', () => {
    const dartKey = '//reg.example.com/:_authToken';
    expect(ignoresNpmConfigEnv('yarn', '1.22.22')('registry')).toBe(false);
    expect(ignoresNpmConfigEnv('yarn', '2.4.3')('registry')).toBe(true);
    expect(ignoresNpmConfigEnv('yarn', '4.15.0')('registry')).toBe(true);
    // Berry has no URL-scoped env tier.
    expect(ignoresNpmConfigEnv('yarn', '4.15.0')(dartKey)).toBe(true);
  });

  it('leaves the environment alone for a version it cannot read', () => {
    expect(ignoresNpmConfigEnv('pnpm', null)('registry')).toBe(false);
    expect(ignoresNpmConfigEnv('yarn', 'stable')('registry')).toBe(false);
  });
});
