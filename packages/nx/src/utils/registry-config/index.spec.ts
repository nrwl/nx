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
    expect(
      getNpmSpawnRegistryEnv('is-even', undefined as any, 'pnpm', '11.5.0')
    ).toEqual({});
  });
});
