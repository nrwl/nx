import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import * as os from 'os';
import { join, resolve } from 'path';
import { getBunSpawnRegistryEnv } from './bun';

/**
 * Each case mirrors a cell verified against bun 1.2.23 / 1.3.14 (gates
 * bisected at 1.1.18 for .npmrc and 1.1.31 for ca/cafile): CLI >
 * BUN_CONFIG_REGISTRY > NPM_CONFIG_REGISTRY > npm_config_registry > project
 * .npmrc > global ($XDG_CONFIG_HOME else $HOME)/.npmrc > project bunfig >
 * global bunfig > npmjs. The final pick is always injected because bun does
 * not read npm-only surfaces.
 */
describe('getBunSpawnRegistryEnv', () => {
  let base: string;
  let root: string;
  let home: string;
  const managedEnvKeys = [
    'BUN_CONFIG_REGISTRY',
    'NPM_CONFIG_REGISTRY',
    'npm_config_registry',
    'XDG_CONFIG_HOME',
  ];
  const savedEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    base = mkdtempSync(join(os.tmpdir(), 'nx-registry-bun-'));
    root = join(base, 'workspace');
    mkdirSync(root);
    home = join(base, 'home');
    mkdirSync(home);
    // os.homedir() honors HOME (POSIX) / USERPROFILE (Windows); jest.spyOn
    // does not work here because SWC's import interop clones the os module.
    savedEnv['HOME'] = process.env['HOME'];
    savedEnv['USERPROFILE'] = process.env['USERPROFILE'];
    process.env['HOME'] = home;
    process.env['USERPROFILE'] = home;
    for (const key of managedEnvKeys) {
      savedEnv[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    rmSync(base, { recursive: true, force: true });
    for (const key of [...managedEnvKeys, 'HOME', 'USERPROFILE']) {
      if (savedEnv[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = savedEnv[key];
      }
    }
  });

  function writeBunfig(contents: string, dir: string = root): void {
    writeFileSync(
      join(dir, dir === root ? 'bunfig.toml' : '.bunfig.toml'),
      contents
    );
  }

  it('always injects the resolved registry (npmjs default)', () => {
    expect(getBunSpawnRegistryEnv('is-even', root, '1.3.14')).toEqual({
      npm_config_registry: 'https://registry.npmjs.org/',
    });
  });

  it('uses the project bunfig registry', () => {
    writeBunfig('[install]\nregistry = "https://reg-a.example.com/"\n');
    expect(getBunSpawnRegistryEnv('is-even', root, '1.3.14')).toEqual({
      npm_config_registry: 'https://reg-a.example.com/',
    });
  });

  it('lets the project .npmrc beat the bunfig', () => {
    writeBunfig('[install]\nregistry = "https://reg-a.example.com/"\n');
    writeFileSync(join(root, '.npmrc'), 'registry=https://reg-b.example.com/');
    expect(getBunSpawnRegistryEnv('is-even', root, '1.3.14')).toEqual({
      npm_config_registry: 'https://reg-b.example.com/',
    });
  });

  it('lets even the user-level .npmrc beat the project bunfig', () => {
    writeBunfig('[install]\nregistry = "https://reg-a.example.com/"\n');
    writeFileSync(join(home, '.npmrc'), 'registry=https://reg-g.example.com/');
    expect(getBunSpawnRegistryEnv('is-even', root, '1.3.14')).toEqual({
      npm_config_registry: 'https://reg-g.example.com/',
    });
  });

  it('honors env precedence: BUN_CONFIG_REGISTRY > NPM_CONFIG_REGISTRY > npm_config_registry', () => {
    writeFileSync(join(root, '.npmrc'), 'registry=https://reg-b.example.com/');
    process.env.npm_config_registry = 'https://reg-c.example.com/';
    expect(getBunSpawnRegistryEnv('is-even', root, '1.3.14')).toEqual({
      npm_config_registry: 'https://reg-c.example.com/',
    });
    process.env.NPM_CONFIG_REGISTRY = 'https://reg-h.example.com/';
    expect(getBunSpawnRegistryEnv('is-even', root, '1.3.14')).toEqual({
      npm_config_registry: 'https://reg-h.example.com/',
    });
    process.env.BUN_CONFIG_REGISTRY = 'https://reg-i.example.com/';
    expect(getBunSpawnRegistryEnv('is-even', root, '1.3.14')).toEqual({
      npm_config_registry: 'https://reg-i.example.com/',
    });
  });

  it('ignores env registry values that are not http(s) URLs', () => {
    process.env.BUN_CONFIG_REGISTRY = 'reg-i.example.com';
    expect(getBunSpawnRegistryEnv('is-even', root, '1.3.14')).toEqual({
      npm_config_registry: 'https://registry.npmjs.org/',
    });
  });

  it('routes scoped packages through [install.scopes] (with or without @)', () => {
    writeBunfig(
      [
        '[install]',
        'registry = "https://reg-a.example.com/"',
        '[install.scopes]',
        '"@types" = "https://reg-e.example.com/"',
        'myorg = "https://reg-f.example.com/"',
      ].join('\n')
    );
    expect(getBunSpawnRegistryEnv('@types/node', root, '1.3.14')).toEqual({
      npm_config_registry: 'https://reg-a.example.com/',
      'npm_config_@types:registry': 'https://reg-e.example.com/',
    });
    expect(getBunSpawnRegistryEnv('@myorg/pkg', root, '1.3.14')).toEqual({
      npm_config_registry: 'https://reg-a.example.com/',
      'npm_config_@myorg:registry': 'https://reg-f.example.com/',
    });
  });

  it('lets an .npmrc scoped key beat the bunfig scoped key', () => {
    writeBunfig(
      ['[install.scopes]', '"@types" = "https://reg-e.example.com/"'].join('\n')
    );
    writeFileSync(
      join(root, '.npmrc'),
      '@types:registry=https://reg-f.example.com/'
    );
    expect(getBunSpawnRegistryEnv('@types/node', root, '1.3.14')).toEqual({
      npm_config_registry: 'https://registry.npmjs.org/',
      'npm_config_@types:registry': 'https://reg-f.example.com/',
    });
  });

  it('translates bunfig registry credentials to npm auth keys', () => {
    writeBunfig(
      [
        '[install]',
        'registry = { url = "https://reg-a.example.com/", token = "tok" }',
      ].join('\n')
    );
    expect(getBunSpawnRegistryEnv('is-even', root, '1.3.14')).toEqual({
      npm_config_registry: 'https://reg-a.example.com/',
      'npm_config_//reg-a.example.com/:_authToken': 'tok',
    });
  });

  it('translates bunfig user/password credentials to npm auth keys', () => {
    writeBunfig(
      [
        '[install]',
        'registry = { url = "https://reg-a.example.com/", username = "alice", password = "s3cret" }',
      ].join('\n')
    );
    // bun sends Basic base64(user:pass) for these; npm reconstructs the same
    // header from username plus a base64 _password.
    expect(getBunSpawnRegistryEnv('is-even', root, '1.3.14')).toEqual({
      npm_config_registry: 'https://reg-a.example.com/',
      'npm_config_//reg-a.example.com/:username': 'alice',
      'npm_config_//reg-a.example.com/:_password':
        Buffer.from('s3cret').toString('base64'),
    });
  });

  it('translates URL-embedded user:pass credentials', () => {
    writeBunfig(
      '[install]\nregistry = "https://user:pass@reg-a.example.com/"\n'
    );
    expect(getBunSpawnRegistryEnv('is-even', root, '1.3.14')).toEqual({
      npm_config_registry: 'https://reg-a.example.com/',
      'npm_config_//reg-a.example.com/:username': 'user',
      'npm_config_//reg-a.example.com/:_password':
        Buffer.from('pass').toString('base64'),
    });
  });

  it('drops a username-only URL credential (bun emits no token for it)', () => {
    writeBunfig('[install]\nregistry = "https://user@reg-a.example.com/"\n');
    expect(getBunSpawnRegistryEnv('is-even', root, '1.3.14')).toEqual({
      npm_config_registry: 'https://reg-a.example.com/',
    });
  });

  it('joins a bunfig [install].ca array with a blank line for npm', () => {
    writeBunfig(
      ['[install]', 'ca = ["-----CA-ONE-----", "-----CA-TWO-----"]'].join('\n')
    );
    expect(getBunSpawnRegistryEnv('is-even', root, '1.3.14')).toEqual({
      npm_config_registry: 'https://registry.npmjs.org/',
      npm_config_ca: '-----CA-ONE-----\n\n-----CA-TWO-----',
    });
  });

  it('assumes a current bun (all gates pass) when the version is unknown', () => {
    writeFileSync(join(root, '.npmrc'), 'registry=https://reg-b.example.com/');
    expect(getBunSpawnRegistryEnv('is-even', root, null)).toEqual({
      npm_config_registry: 'https://reg-b.example.com/',
    });
  });

  it('expands ${VAR} references in .npmrc values', () => {
    writeFileSync(
      join(root, '.npmrc'),
      'registry=${NX_TEST_BUN_REGISTRY_VALUE}'
    );
    process.env.NX_TEST_BUN_REGISTRY_VALUE = 'https://reg-j.example.com/';
    try {
      expect(getBunSpawnRegistryEnv('is-even', root, '1.3.14')).toEqual({
        npm_config_registry: 'https://reg-j.example.com/',
      });
    } finally {
      delete process.env.NX_TEST_BUN_REGISTRY_VALUE;
    }
  });

  it('expands a whole-value $VAR (no braces) in a bunfig registry URL', () => {
    writeBunfig('[install]\nregistry = "$NX_TEST_BUN_REG"\n');
    process.env.NX_TEST_BUN_REG = 'https://reg-l.example.com/';
    try {
      expect(getBunSpawnRegistryEnv('is-even', root, '1.3.14')).toEqual({
        npm_config_registry: 'https://reg-l.example.com/',
      });
    } finally {
      delete process.env.NX_TEST_BUN_REG;
    }
  });

  it('expands a whole-value $VAR in bunfig registry credentials', () => {
    writeBunfig(
      [
        '[install]',
        'registry = { url = "https://reg-a.example.com/", token = "$NX_TEST_BUN_TOKEN" }',
      ].join('\n')
    );
    process.env.NX_TEST_BUN_TOKEN = 'real-token';
    try {
      expect(getBunSpawnRegistryEnv('is-even', root, '1.3.14')).toEqual({
        npm_config_registry: 'https://reg-a.example.com/',
        'npm_config_//reg-a.example.com/:_authToken': 'real-token',
      });
    } finally {
      delete process.env.NX_TEST_BUN_TOKEN;
    }
  });

  it('keeps a braced ${VAR} literal in bunfig (bun expands braces only in .npmrc)', () => {
    writeBunfig(
      '[install]\nregistry = { url = "https://reg-a.example.com/", token = "${NX_TEST_BUN_TOKEN}" }\n'
    );
    process.env.NX_TEST_BUN_TOKEN = 'real-token';
    try {
      expect(getBunSpawnRegistryEnv('is-even', root, '1.3.14')).toEqual({
        npm_config_registry: 'https://reg-a.example.com/',
        'npm_config_//reg-a.example.com/:_authToken': '${NX_TEST_BUN_TOKEN}',
      });
    } finally {
      delete process.env.NX_TEST_BUN_TOKEN;
    }
  });

  it('reads the global npmrc/bunfig from XDG_CONFIG_HOME and swaps npm userconfig', () => {
    const xdg = join(base, 'xdg');
    mkdirSync(xdg);
    process.env.XDG_CONFIG_HOME = xdg;
    writeFileSync(join(xdg, '.npmrc'), 'registry=https://reg-k.example.com/');
    // ~/.npmrc must be ignored when XDG_CONFIG_HOME is set (bun semantics).
    writeFileSync(join(home, '.npmrc'), 'registry=https://reg-g.example.com/');
    expect(getBunSpawnRegistryEnv('is-even', root, '1.3.14')).toEqual({
      npm_config_userconfig: join(xdg, '.npmrc'),
      npm_config_registry: 'https://reg-k.example.com/',
    });
  });

  it('ignores .npmrc entirely below bun 1.1.18', () => {
    writeBunfig('[install]\nregistry = "https://reg-a.example.com/"\n');
    writeFileSync(join(root, '.npmrc'), 'registry=https://reg-b.example.com/');
    expect(getBunSpawnRegistryEnv('is-even', root, '1.1.17')).toEqual({
      npm_config_registry: 'https://reg-a.example.com/',
    });
  });

  it('bridges bunfig cafile (>= 1.1.31) resolved against the project dir, unless the .npmrc defines TLS', () => {
    writeBunfig(
      [
        '[install]',
        'registry = "https://reg-a.example.com/"',
        'cafile = "./certs/ca.pem"',
      ].join('\n')
    );
    expect(getBunSpawnRegistryEnv('is-even', root, '1.3.14')).toEqual({
      npm_config_registry: 'https://reg-a.example.com/',
      npm_config_cafile: resolve(root, './certs/ca.pem'),
    });
    expect(getBunSpawnRegistryEnv('is-even', root, '1.1.30')).toEqual({
      npm_config_registry: 'https://reg-a.example.com/',
    });
    writeFileSync(join(root, '.npmrc'), 'cafile=./other-ca.pem');
    expect(getBunSpawnRegistryEnv('is-even', root, '1.3.14')).toEqual({
      npm_config_registry: 'https://reg-a.example.com/',
    });
  });
});
