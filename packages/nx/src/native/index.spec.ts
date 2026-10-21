import { execFileSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

// Node 22.15.0–22.22.2 and 24.0.0–24.11.0 (and 23.5–25.0) evaluate CommonJS
// imported from ESM with their internal loader once a `module.registerHooks()`
// load hook is installed, as Playwright 1.64 does. That loader's `require` has
// `resolve` but no `cache`. Later versions route back through the real
// `require` (nodejs/node#59929, #60380), so only the first test below fails on
// the old code everywhere: it hands the loader such a `require` itself.
const hasSyncHooks =
  typeof (require('node:module') as any).registerHooks === 'function';

describe('native loader', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'nx-native-loader-'));
    // The loader with stubs for everything it requires, so the test needs no
    // compiled TypeScript and no native binary.
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
});
