import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  copyFileSync,
  chmodSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

// Node 22.15–22.22.2 and 24.0–24.11.0 hand CJS imported from ESM under a
// registerHooks load hook a `require` without `cache` (fixed upstream in
// nodejs/node#59929, #60380).
const hasSyncHooks =
  typeof (require('node:module') as any).registerHooks === 'function';

describe('native loader', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'nx-native-loader-'));
    mkdirSync(join(dir, 'native'));
    mkdirSync(join(dir, 'utils'));
    writeFileSync(
      join(dir, 'native', 'index.js'),
      readFileSync(join(__dirname, 'index.js'))
    );
    writeFileSync(
      join(dir, 'native', 'native-bindings.js'),
      'module.exports = { loaded: true };'
    );
    writeFileSync(
      join(dir, 'native', 'native-file-cache-location.js'),
      'module.exports = { ensureSecureNativeFileCacheLocation: () => {} };'
    );
    writeFileSync(
      join(dir, 'utils', 'versions.js'),
      "module.exports = { nxVersion: '0.0.0' };"
    );
    // Evaluates the loader the way node's internal CommonJS loader does: a
    // `require` with `resolve` but no `cache`. A child process keeps the
    // loader's process.emit patch out of the test worker.
    writeFileSync(
      join(dir, 'runner.cjs'),
      [
        "const { readFileSync } = require('node:fs');",
        "const { createRequire } = require('node:module');",
        "const { dirname } = require('node:path');",
        "const vm = require('node:vm');",
        'const file = process.argv[2];',
        'const real = createRequire(file);',
        'const bare = Object.assign((id) => real(id), { resolve: real.resolve });',
        'const mod = { exports: {} };',
        'vm.compileFunction(',
        "  readFileSync(file, 'utf8'),",
        "  ['exports', 'require', 'module', '__filename', '__dirname'],",
        '  { filename: file }',
        ')(mod.exports, bare, mod, file, dirname(file));',
        'console.log(JSON.stringify(mod.exports));',
      ].join('\n')
    );
    writeFileSync(
      join(dir, 'hook.mjs'),
      [
        "import { registerHooks } from 'node:module';",
        'registerHooks({ load: (url, context, next) => next(url, context) });',
      ].join('\n')
    );
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  const entry = () => join(dir, 'native', 'index.js');

  it('loads through a require that has no cache', () => {
    const output = execFileSync(
      process.execPath,
      [join(dir, 'runner.cjs'), entry()],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
    );
    expect(output.trim()).toBe('{"loaded":true}');
  });

  (hasSyncHooks ? it : it.skip)(
    'loads when imported from ESM under a module.registerHooks() hook',
    () => {
      const output = execFileSync(
        process.execPath,
        [
          '--import',
          pathToFileURL(join(dir, 'hook.mjs')).href,
          '--input-type=module',
          '-e',
          `import('${pathToFileURL(entry()).href}').then((m) => console.log(JSON.stringify(m.default)))`,
        ],
        { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
      );
      expect(output.trim()).toBe('{"loaded":true}');
    }
  );

  it.each([
    ['remove-cache', 'stat'],
    ['remove-cache', 'dlopen'],
    ['restore-cache', 'dlopen'],
    ['corrupt-cache', 'dlopen'],
  ])('loads the original binding after %s during %s', (change, phase) => {
    const result = loadWithCacheChange(phase, change);
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout.trim()).toBe('loaded');
    expect(result.stderr).toBe('');
  });

  it.each([
    ['remove-source', /^(ERR_DLOPEN_FAILED|MODULE_NOT_FOUND)$/],
    ['corrupt-source', /^ERR_DLOPEN_FAILED$/],
  ] as const)(
    'rejects the native binding error after %s',
    (change, errorCode) => {
      const result = loadWithCacheChange('dlopen', change);
      expect(result.status).toBe(1);
      expect(result.stdout).toBe('');
      const error = JSON.parse(result.stderr);
      expect(error.code).toMatch(errorCode);
      expect(error.message).toContain(result.source);
    }
  );

  function loadWithCacheChange(phase: string, change: string) {
    const host = `${process.platform}-${process.arch}`;
    const binaries = readdirSync(__dirname).filter(
      (file) =>
        (file.startsWith(`nx.${host}.`) || file.startsWith(`nx.${host}-`)) &&
        file.endsWith('.node')
    );
    if (binaries.length !== 1) {
      throw new Error(
        `Expected one built native binding for ${host}, found ${binaries.length}.`
      );
    }
    const binary = binaries[0];
    const env = { ...process.env, NX_SKIP_NATIVE_FILE_CACHE: 'false' };
    const source = join(realpathSync(dir), 'native', binary);
    copyFileSync(join(__dirname, binary), source);
    const cache = join(realpathSync(dir), 'cache');
    mkdirSync(cache);
    writeFileSync(
      join(dir, 'native', 'native-file-cache-location.js'),
      `module.exports = { ensureSecureNativeFileCacheLocation: () => ${JSON.stringify(cache)} };`
    );
    writeFileSync(
      join(dir, 'native', 'native-bindings.js'),
      `module.exports = require(${JSON.stringify(`./${binary}`)});`
    );
    if (phase === 'stat') {
      execFileSync(
        process.execPath,
        ['-e', `require(${JSON.stringify(entry())})`],
        { env }
      );
    }
    const runner = join(dir, 'cache-change.cjs');
    writeFileSync(
      runner,
      `
const fs = require('node:fs');
const { sep } = require('node:path');
const cache = ${JSON.stringify(cache)};
const source = ${JSON.stringify(source)};
const phase = ${JSON.stringify(phase)};
const change = ${JSON.stringify(change)};
let changed = false;
const changeCache = (file) => {
  if (changed || !file.startsWith(cache + sep)) return;
  changed = true;
  if (change === 'corrupt-cache') {
    fs.writeFileSync(file, 'invalid native binding');
  } else {
    fs.rmSync(cache, { recursive: true });
    if (change === 'remove-source') {
      fs.unlinkSync(source);
    } else if (change === 'corrupt-source') {
      fs.writeFileSync(source, 'invalid native binding');
    }
  }
};
const statSync = fs.statSync;
fs.statSync = function(file, ...args) {
  const result = statSync.call(this, file, ...args);
  if (phase === 'stat') changeCache(file);
  return result;
};
const dlopen = process.dlopen;
process.dlopen = function(module, file, ...args) {
  if (phase === 'dlopen') changeCache(file);
  try {
    return dlopen.call(this, module, file, ...args);
  } catch (error) {
    if (change === 'restore-cache' && file.startsWith(cache + sep)) {
      fs.mkdirSync(cache);
      fs.copyFileSync(source, file);
    }
    throw error;
  }
};
try {
  const binding = require(${JSON.stringify(entry())});
  if (!changed || typeof binding.WorkspaceContext !== 'function') process.exit(2);
  console.log('loaded');
} catch (error) {
  if (!changed) process.exit(2);
  console.error(JSON.stringify({ code: error.code, message: error.message }));
  process.exitCode = 1;
}
`
    );
    return {
      ...spawnSync(process.execPath, [runner], { encoding: 'utf8', env }),
      source,
    };
  }
});

describe('native file cache entries', () => {
  const bindingName = 'nx.linux-x64-gnu.node';
  let dir: string;
  let cacheDir: string;
  let binding: string;
  let cacheEntry: string;

  beforeEach(() => {
    dir = realpathSync(mkdtempSync(join(tmpdir(), 'nx-native-cache-')));
    cacheDir = join(dir, 'cache');
    mkdirSync(cacheDir, { mode: 0o700 });
    mkdirSync(join(dir, 'native'));
    mkdirSync(join(dir, 'utils'));
    mkdirSync(join(dir, 'pkg'));
    writeFileSync(
      join(dir, 'native', 'index.js'),
      readFileSync(join(__dirname, 'index.js'))
    );
    writeFileSync(
      join(dir, 'native', 'native-bindings.js'),
      'module.exports = require(process.env.TEST_BINDING);'
    );
    writeFileSync(
      join(dir, 'native', 'native-file-cache-location.js'),
      'module.exports = { ensureSecureNativeFileCacheLocation: () => process.env.TEST_CACHE_DIR };'
    );
    writeFileSync(
      join(dir, 'utils', 'versions.js'),
      "module.exports = { nxVersion: '0.0.0' };"
    );
    writeFileSync(
      join(dir, 'runner.cjs'),
      [
        "const Module = require('node:module');",
        "const { readFileSync } = require('node:fs');",
        "Module._extensions['.node'] = (m, f) => { m.exports = { content: readFileSync(f, 'utf8') }; };",
        // We cannot chown without root, so move our own uid instead.
        'if (process.env.TEST_FOREIGN_OWNER) { const uid = process.getuid(); process.getuid = () => uid + 1; }',
        'console.log(JSON.stringify(require(process.argv[2])));',
      ].join('\n')
    );

    binding = join(dir, 'pkg', bindingName);
    writeFileSync(binding, 'genuine');
    const key = createHash('sha256')
      .update(binding)
      .digest('hex')
      .substring(0, 12);
    cacheEntry = join(cacheDir, `0.0.0-${key}-${bindingName}`);
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  const load = (env: Record<string, string> = {}): string =>
    JSON.parse(
      execFileSync(
        process.execPath,
        [join(dir, 'runner.cjs'), join(dir, 'native', 'index.js')],
        {
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'pipe'],
          env: {
            ...process.env,
            NX_SKIP_NATIVE_FILE_CACHE: 'false',
            TEST_BINDING: binding,
            TEST_CACHE_DIR: cacheDir,
            ...env,
          },
        }
      )
    ).content;

  it('reuses a fresh entry the current user owns', () => {
    writeFileSync(cacheEntry, 'cached!', { mode: 0o644 });

    expect(load()).toBe('cached!');
  });

  (process.platform === 'win32' ? it.skip : it)(
    'replaces a fresh entry that others can write to',
    () => {
      writeFileSync(cacheEntry, 'planted', { mode: 0o666 });
      chmodSync(cacheEntry, 0o666);

      expect(load()).toBe('genuine');
      expect(readFileSync(cacheEntry, 'utf8')).toBe('genuine');
      expect(lstatSync(cacheEntry).mode & 0o022).toBe(0);
    }
  );

  (process.platform === 'win32' ? it.skip : it)(
    'replaces a fresh entry another user owns',
    () => {
      writeFileSync(cacheEntry, 'planted', { mode: 0o644 });

      expect(load({ TEST_FOREIGN_OWNER: '1' })).toBe('genuine');
      expect(readFileSync(cacheEntry, 'utf8')).toBe('genuine');
    }
  );

  (process.platform === 'win32' ? it.skip : it)(
    'replaces a fresh entry that is a symlink',
    () => {
      const planted = join(dir, 'planted.node');
      writeFileSync(planted, 'planted', { mode: 0o644 });
      symlinkSync(planted, cacheEntry);

      expect(load()).toBe('genuine');
      expect(lstatSync(cacheEntry).isSymbolicLink()).toBe(false);
    }
  );

  (process.platform === 'win32' ? it.skip : it)(
    'keeps its own copy owner-writable only',
    () => {
      chmodSync(binding, 0o666);

      expect(load()).toBe('genuine');
      expect(lstatSync(cacheEntry).mode & 0o022).toBe(0);
      expect(load()).toBe('genuine');
    }
  );
});
