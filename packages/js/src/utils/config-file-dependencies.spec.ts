import { TempFs } from '@nx/devkit/internal-testing-utils';
import { join } from 'node:path';
import { createConfigFileDependencyCollector } from './config-file-dependencies';

describe('config file dependencies', () => {
  let fs: TempFs;
  const collect = (config = 'apps/e2e/config.cjs') =>
    createConfigFileDependencyCollector(fs.tempDir)(config);

  beforeEach(() => {
    fs = new TempFs('config-dependencies');
    fs.createFilesSync({
      'package.json': '{}',
      'apps/e2e/config.cjs': `module.exports = require('./helper.cjs');`,
      'apps/e2e/helper.cjs': `module.exports = require('../../shared/config.cjs');`,
      'shared/config.cjs': `module.exports = require('./selection.json');`,
      'shared/selection.json': '{"selected":"a"}',
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    fs.cleanup();
  });

  it('hashes transitive imports, including ignored files, without unrelated workspace files', () => {
    fs.createFilesSync({
      '.gitignore': 'shared/selection.json\n',
      'unrelated.cjs': 'module.exports = 1;',
    });
    const first = collect();
    expect(first.files).toEqual([
      'apps/e2e/config.cjs',
      'apps/e2e/helper.cjs',
      'package.json',
      'shared/config.cjs',
      'shared/selection.json',
    ]);
    expect(collect().hash).toBe(first.hash);
    fs.writeFile('unrelated.cjs', 'module.exports = 2;');
    expect(collect().hash).toBe(first.hash);
    fs.writeFile('shared/selection.json', '{"selected":"b"}');
    expect(collect().hash).not.toBe(first.hash);
  });

  it('revisits removed, created and changed imports and terminates cycles', () => {
    fs.writeFile(
      'shared/config.cjs',
      `require('../apps/e2e/config.cjs'); module.exports = require('./selection.json'); try { require('./optional.cjs'); } catch {}`
    );
    const first = collect().hash;
    fs.removeFileSync('shared/selection.json');
    expect(collect().hash).not.toBe(first);
    const removed = collect().hash;
    fs.createFileSync('shared/optional.cjs', 'module.exports = 1;');
    expect(collect().hash).not.toBe(removed);
  });

  it('follows exports, dynamic imports, TS runtime fallbacks, and URL imports', () => {
    fs.createFilesSync({
      'apps/e2e/config.mts': `export * from '../../shared/entry.js'; const value = await import('../../shared/lazy.mjs?mode=x');`,
      'shared/entry.ts': `import data = require('./selection.json'); export { data };`,
      'shared/lazy.mjs': `export { default } from './selection.json' with { type: 'json' };`,
    });
    expect(collect('apps/e2e/config.mts').files).toEqual(
      expect.arrayContaining([
        'shared/entry.ts',
        'shared/lazy.mjs',
        'shared/selection.json',
      ])
    );
    fs.createFileSync('shared/entry.js', 'export const selected = "real-js";');
    const files = collect('apps/e2e/config.mts').files;
    expect(files).toContain('shared/entry.js');
    expect(files).not.toContain('shared/entry.ts');
  });

  it('follows cooked template literals without expressions', () => {
    fs.createFilesSync({
      'apps/e2e/config.cjs':
        'module.exports = require(`../../shared/selection\\x2ejson`); import(`../../shared/lazy.cjs`);',
      'shared/lazy.cjs': 'module.exports = {};',
    });
    const first = collect();
    expect(first.files).toEqual(
      expect.arrayContaining(['shared/selection.json', 'shared/lazy.cjs'])
    );
    fs.writeFile('shared/selection.json', '{"selected":"b"}');
    expect(collect().hash).not.toBe(first.hash);
  });

  it('preserves CommonJS filenames that are not valid file URLs', () => {
    fs.createFilesSync({
      'apps/e2e/config.cjs':
        "module.exports = require('../../shared/50%.cjs'); require('../../shared/selection%2F.json');",
      'shared/50%.cjs': 'module.exports = {};',
      'shared/selection%2F.json': '{}',
    });
    expect(collect().files).toEqual(
      expect.arrayContaining(['shared/50%.cjs', 'shared/selection%2F.json'])
    );
  });

  it('resolves inherited aliases to runtime package entries, not declarations', () => {
    fs.createFilesSync({
      'apps/e2e/tsconfig.json': '{"extends":"../../tsconfig.base.json"}',
      'tsconfig.base.json':
        '{"compilerOptions":{"paths":{"@settings":["shared/settings"]}}}',
      'apps/e2e/config.cjs': `module.exports = require('@settings');`,
      'shared/settings/package.json':
        '{"main":"runtime.cjs","types":"index.d.ts"}',
      'shared/settings/runtime.cjs': `module.exports = require('../selection.json');`,
      'shared/settings/index.d.ts': 'export declare const selected: string;',
    });
    const first = collect();
    expect(first.files).toEqual(
      expect.arrayContaining([
        'apps/e2e/tsconfig.json',
        'tsconfig.base.json',
        'shared/settings/package.json',
        'shared/settings/runtime.cjs',
        'shared/selection.json',
      ])
    );
    expect(first.files).not.toContain('shared/settings/index.d.ts');
    fs.writeFile('shared/selection.json', '{"selected":"b"}');
    expect(collect().hash).not.toBe(first.hash);
  });

  it('matches runtime alias resolution when multiple extends define paths', () => {
    fs.createFilesSync({
      'apps/e2e/tsconfig.json':
        '{"extends":["../../shared/a/tsconfig.json","../../shared/b/tsconfig.json"]}',
      'apps/e2e/config.cjs': "module.exports = require('@settings');",
      'shared/a/tsconfig.json':
        '{"compilerOptions":{"paths":{"@settings":["./runtime.cjs"]}}}',
      'shared/b/tsconfig.json':
        '{"compilerOptions":{"paths":{"@settings":["./runtime.cjs"]}}}',
      'shared/a/runtime.cjs': 'module.exports = "a";',
      'shared/b/runtime.cjs': 'module.exports = "unused";',
    });
    // registerTsConfigPaths currently resolves this shared path against A.
    const first = collect();
    expect(first.files).toEqual(
      expect.arrayContaining([
        'shared/a/tsconfig.json',
        'shared/b/tsconfig.json',
        'shared/a/runtime.cjs',
      ])
    );
    expect(first.files).not.toContain('shared/b/runtime.cjs');
    fs.writeFile('shared/b/runtime.cjs', 'module.exports = "still-unused";');
    expect(collect().hash).toBe(first.hash);
    fs.writeFile('shared/a/runtime.cjs', 'module.exports = "b";');
    expect(collect().hash).not.toBe(first.hash);
  });

  it('reuses shared probes and edges while retaining each config dependency set', () => {
    fs.createFilesSync({
      'apps/e2e/tsconfig.json': '{"extends":"../../tsconfig.base.json"}',
      'apps/other/tsconfig.json': '{"extends":"../../tsconfig.base.json"}',
      'tsconfig.base.json':
        '{"compilerOptions":{"paths":{"@selection":["shared/selection.json"]}}}',
      'shared/config.cjs': "module.exports = require('@selection');",
      'apps/other/config.cjs':
        "module.exports = require('../../shared/config.cjs'); require('./only.cjs');",
      'apps/other/only.cjs': 'module.exports = {};',
      'apps/alone/config.cjs': 'module.exports = {};',
    });
    const nodeFs = require('node:fs');
    const probes = ['realpathSync', 'statSync', 'existsSync'].map((method) =>
      jest.spyOn(nodeFs, method)
    );
    const sharedProbes = () =>
      probes.map(
        (probe) =>
          probe.mock.calls.filter(([path]) =>
            String(path).includes(join(fs.tempDir, 'shared'))
          ).length
      );
    const collectPass = createConfigFileDependencyCollector(fs.tempDir);
    collectPass('apps/e2e/config.cjs');
    const initialProbes = sharedProbes();
    expect(initialProbes.reduce((sum, count) => sum + count)).toBeGreaterThan(
      0
    );

    const second = collectPass('apps/other/config.cjs');
    expect(sharedProbes()).toEqual(initialProbes);
    expect(second.files).toEqual(
      expect.arrayContaining([
        'shared/config.cjs',
        'shared/selection.json',
        'apps/other/only.cjs',
      ])
    );
    expect(second.files).not.toContain('apps/e2e/helper.cjs');
    expect(second.files).not.toContain('apps/e2e/config.cjs');
    expect(collectPass('apps/alone/config.cjs').files).not.toContain(
      'shared/selection.json'
    );
  });

  it('keeps cached edges separate when configs have different aliases', () => {
    fs.createFilesSync({
      'apps/e2e/tsconfig.json':
        '{"compilerOptions":{"paths":{"@selection":["../../shared/a.json"]}}}',
      'apps/other/tsconfig.json':
        '{"compilerOptions":{"paths":{"@selection":["../../shared/b.json"]}}}',
      'apps/other/config.cjs':
        "module.exports = require('../../shared/config.cjs');",
      'shared/config.cjs': "module.exports = require('@selection');",
      'shared/a.json': '"a"',
      'shared/b.json': '"b"',
    });
    const collectPass = createConfigFileDependencyCollector(fs.tempDir);
    const first = collectPass('apps/e2e/config.cjs');
    const second = collectPass('apps/other/config.cjs');
    expect(first.files).toContain('shared/a.json');
    expect(first.files).not.toContain('shared/b.json');
    expect(second.files).toContain('shared/b.json');
    expect(second.files).not.toContain('shared/a.json');
  });

  it('tracks both runtime conditions of workspace package exports, including ESM-only exports', () => {
    fs.createFilesSync({
      'apps/e2e/config.cjs': `module.exports = require('@workspace/settings'); import('@workspace/settings/esm');`,
      'shared/settings/package.json': JSON.stringify({
        name: '@workspace/settings',
        exports: {
          '.': {
            import: './import.mjs',
            require: './require.cjs',
            types: './index.d.ts',
          },
          './esm': { import: './import.mjs' },
        },
      }),
      'shared/settings/import.mjs': `export { default } from '../selection.json' with { type: 'json' };`,
      'shared/settings/require.cjs': 'module.exports = {};',
      'shared/settings/index.d.ts': 'export declare const selected: string;',
    });
    fs.createSymlinkSync(
      'shared/settings',
      'node_modules/@workspace/settings',
      'dir'
    );
    const first = collect();
    expect(first.files).toEqual(
      expect.arrayContaining([
        'shared/settings/package.json',
        'shared/settings/import.mjs',
        'shared/settings/require.cjs',
        'shared/selection.json',
      ])
    );
    fs.writeFile('shared/selection.json', '{"selected":"b"}');
    expect(collect().hash).not.toBe(first.hash);
  });

  it('accepts CJS returns and decorated TypeScript without running Babel configs', () => {
    fs.createFilesSync({
      'babel.config.cjs': `throw new Error('must not evaluate');`,
      'apps/e2e/config.cjs': `if (false) return; module.exports = require('../../shared/config.ts');`,
      'shared/config.ts': `// nx-ignore-next-line\nimport data from './selection.json'; function decorator(target: any) {} @decorator class Config {} export default data;`,
    });
    expect(collect().files).toContain('shared/selection.json');
    expect(collect().hash).toBeDefined();
  });

  it('disables caching when syntax or tsconfig resolution prevents a complete closure', () => {
    fs.writeFile('shared/config.cjs', 'unsupported future syntax');
    expect(collect().hash).toBeUndefined();
    fs.writeFile('shared/config.cjs', 'module.exports = {};');
    fs.createFileSync('apps/e2e/tsconfig.json', 'invalid JSON');
    expect(collect().hash).toBeUndefined();
  });
});
