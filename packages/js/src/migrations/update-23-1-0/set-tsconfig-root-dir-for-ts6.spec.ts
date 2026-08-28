import { readJson, type Tree } from '@nx/devkit';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

import migration from './set-tsconfig-root-dir-for-ts6';
import { FsTree } from '@nx/devkit/internal';

describe('set-tsconfig-root-dir-for-ts6 migration', () => {
  let root: string;
  let tree: Tree;

  const write = (relPath: string, content: unknown) => {
    const full = join(root, relPath);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(
      full,
      typeof content === 'string' ? content : JSON.stringify(content, null, 2)
    );
  };

  const rootDirOf = (relPath: string): string | undefined =>
    readJson(tree, relPath).compilerOptions?.rootDir;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'nx-rootdir-ts6-'));
    write('package.json', { name: 'test-ws' });
    write('nx.json', {});
    write('tsconfig.base.json', {
      compilerOptions: {
        baseUrl: '.',
        module: 'commonjs',
        moduleResolution: 'node',
        paths: { '@proj/b': ['libs/b/src/index'] },
      },
    });
    // shared library the cross-project specs import
    write('libs/b/src/index.ts', `export const b = 1;\n`);
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  function run() {
    tree = new FsTree(root, false);
    return migration(tree);
  }

  it('pins rootDir to the inferred common dir for a cross-project spec tsconfig', async () => {
    write('libs/a/project.json', { name: 'a', root: 'libs/a' });
    write(
      'libs/a/src/index.spec.ts',
      `import { b } from '@proj/b';\nconsole.log(b);\n`
    );
    write('libs/a/tsconfig.spec.json', {
      extends: '../../tsconfig.base.json',
      compilerOptions: { outDir: '../../dist/out-tsc' },
      include: ['src/**/*.ts'],
    });

    await run();

    expect(rootDirOf('libs/a/tsconfig.spec.json')).toBe('..');
  });

  it('pins rootDir to a deeper source subdirectory for a self-contained project', async () => {
    write('libs/c/project.json', { name: 'c', root: 'libs/c' });
    write('libs/c/src/deep/nested.ts', `export const c = 2;\n`);
    write('libs/c/tsconfig.spec.json', {
      compilerOptions: {
        outDir: '../../dist/out-tsc',
        module: 'commonjs',
        moduleResolution: 'node',
      },
      include: ['src/**/*.ts'],
    });

    await run();

    expect(rootDirOf('libs/c/tsconfig.spec.json')).toBe('src/deep');
  });

  it('leaves a config without an output option untouched', async () => {
    write('libs/d/project.json', { name: 'd', root: 'libs/d' });
    write('libs/d/src/index.ts', `export const d = 3;\n`);
    write('libs/d/tsconfig.json', {
      compilerOptions: {
        noEmit: true,
        module: 'commonjs',
        moduleResolution: 'node',
      },
      include: ['src/**/*.ts'],
    });

    await run();

    expect(rootDirOf('libs/d/tsconfig.json')).toBeUndefined();
  });

  it('leaves a config that already sets rootDir untouched', async () => {
    write('libs/e/project.json', { name: 'e', root: 'libs/e' });
    write('libs/e/src/index.ts', `export const e = 4;\n`);
    write('libs/e/tsconfig.json', {
      compilerOptions: {
        outDir: '../../dist/out-tsc',
        rootDir: 'src',
        module: 'commonjs',
        moduleResolution: 'node',
      },
      include: ['src/**/*.ts'],
    });

    await run();

    expect(rootDirOf('libs/e/tsconfig.json')).toBe('src');
  });

  it('writes rootDir on each sibling instead of a shared base', async () => {
    write('libs/col/project.json', { name: 'col', root: 'libs/col' });
    write(
      'libs/col/src/index.ts',
      `import { b } from '@proj/b';\nexport const x = b;\n`
    );
    write(
      'libs/col/src/index.spec.ts',
      `import { b } from '@proj/b';\nconsole.log(b);\n`
    );
    write('libs/col/tsconfig.json', {
      extends: '../../tsconfig.base.json',
      files: [],
      references: [
        { path: './tsconfig.lib.json' },
        { path: './tsconfig.spec.json' },
      ],
    });
    write('libs/col/tsconfig.lib.json', {
      extends: './tsconfig.json',
      compilerOptions: { outDir: '../../dist/out-tsc' },
      include: ['src/**/*.ts'],
    });
    write('libs/col/tsconfig.spec.json', {
      extends: './tsconfig.json',
      compilerOptions: { outDir: '../../dist/out-tsc' },
      include: ['src/**/*.ts'],
    });

    await run();

    // The solution-style base is never written; each sibling pins its own value.
    expect(rootDirOf('libs/col/tsconfig.json')).toBeUndefined();
    expect(rootDirOf('libs/col/tsconfig.lib.json')).toBe('..');
    expect(rootDirOf('libs/col/tsconfig.spec.json')).toBe('..');
  });

  it('pins rootDir to "." when the inferred dir is the config directory (per-file compiles re-infer deeper)', async () => {
    // Regression: ts-jest's `isolatedModules` compiles each test file as its
    // own single-file program, so the common source directory collapses to
    // that file's folder and TS6 fails with TS5011 unless rootDir is explicit.
    // The declared include spans the config dir root (jest.config.ts), which
    // used to classify this config as already-safe and skip the pin.
    write('libs/own/project.json', { name: 'own', root: 'libs/own' });
    write('libs/own/jest.config.ts', `export default {};\n`);
    write('libs/own/src/deep/index.test.ts', `export const t = 1;\n`);
    write('libs/own/tsconfig.spec.json', {
      compilerOptions: {
        outDir: 'out-tsc/jest',
        module: 'commonjs',
        moduleResolution: 'node',
      },
      include: ['jest.config.ts', 'src/**/*.ts'],
    });

    await run();

    expect(rootDirOf('libs/own/tsconfig.spec.json')).toBe('.');
  });

  it('pins a composite project to its own directory (not the file-derived dir)', async () => {
    write('libs/comp/project.json', { name: 'comp', root: 'libs/comp' });
    write('libs/comp/src/index.ts', `export const c = 5;\n`);
    write('libs/comp/tsconfig.lib.json', {
      compilerOptions: {
        composite: true,
        outDir: '../../dist/out-tsc',
        module: 'commonjs',
        moduleResolution: 'node',
      },
      include: ['src/**/*.ts'],
    });

    await run();

    // Pinned to "." (the config dir), which matches composite's own default so a
    // real composite build is unchanged — NOT the file-derived "src", which would
    // strip the src/ prefix from the emit layout. The explicit value is what
    // ts-jest (which strips composite for its per-file transpile) needs.
    expect(rootDirOf('libs/comp/tsconfig.lib.json')).toBe('.');
  });

  it('pins a composite spec config compiled by ts-jest (composite inherited from base)', async () => {
    // Regression for the nx-console shape: `composite` comes from the base
    // config, the spec config has an emit gate and includes jest.config.ts at
    // its own root plus specs under src/lib. tsc treats it as composite (immune
    // to TS5011 via the `!options.composite` guard), but ts-jest strips composite
    // for its per-file transpile, so a single spec re-infers ./src/lib and hits
    // TS5011 unless rootDir is explicit. Must be pinned to "." (config dir).
    write('tsconfig.composite-base.json', {
      compilerOptions: {
        composite: true,
        module: 'commonjs',
        moduleResolution: 'node',
      },
    });
    write('libs/svc/project.json', { name: 'svc', root: 'libs/svc' });
    write('libs/svc/jest.config.ts', `export default {};\n`);
    write('libs/svc/src/lib/thing.spec.ts', `export const t = 1;\n`);
    write('libs/svc/tsconfig.spec.json', {
      extends: '../../tsconfig.composite-base.json',
      compilerOptions: { outDir: 'out-tsc/jest' },
      include: ['jest.config.ts', 'src/**/*.ts'],
    });

    await run();

    expect(rootDirOf('libs/svc/tsconfig.spec.json')).toBe('.');
  });

  it('pins the composite sibling to its own dir and each non-composite writer to the file-derived dir; leaves the solution base', async () => {
    write('libs/mix/project.json', { name: 'mix', root: 'libs/mix' });
    write('libs/mix/src/index.ts', `export const m = 6;\n`);
    write('libs/mix/src/index.spec.ts', `export const s = 7;\n`);
    write('libs/mix/src/index.e2e.ts', `export const e = 8;\n`);
    write('libs/mix/tsconfig.json', {
      files: [],
      references: [
        { path: './tsconfig.lib.json' },
        { path: './tsconfig.spec.json' },
        { path: './tsconfig.e2e.json' },
      ],
    });
    // composite -> pinned to its own directory (".")
    write('libs/mix/tsconfig.lib.json', {
      extends: './tsconfig.json',
      compilerOptions: {
        composite: true,
        outDir: '../../dist/out-tsc',
        module: 'commonjs',
        moduleResolution: 'node',
      },
      include: ['src/**/*.ts'],
    });
    // two non-composite writers -> file-derived "src"
    write('libs/mix/tsconfig.spec.json', {
      extends: './tsconfig.json',
      compilerOptions: {
        outDir: '../../dist/out-tsc',
        module: 'commonjs',
        moduleResolution: 'node',
      },
      include: ['src/**/*.ts'],
    });
    write('libs/mix/tsconfig.e2e.json', {
      extends: './tsconfig.json',
      compilerOptions: {
        outDir: '../../dist/out-tsc',
        module: 'commonjs',
        moduleResolution: 'node',
      },
      include: ['src/**/*.ts'],
    });

    await run();

    // composite -> its own directory (config dir), preserving its emit layout...
    expect(rootDirOf('libs/mix/tsconfig.lib.json')).toBe('.');
    // ...the solution-style base is never written (no input files)...
    expect(rootDirOf('libs/mix/tsconfig.json')).toBeUndefined();
    // ...and each non-composite writer pins its file-derived directory.
    expect(rootDirOf('libs/mix/tsconfig.spec.json')).toBe('src');
    expect(rootDirOf('libs/mix/tsconfig.e2e.json')).toBe('src');
  });

  it('pins an own-dir child to its own directory instead of inheriting the base pin', async () => {
    // libs/base/tsconfig.json both needs a rootDir (its src imports another
    // project, so its files span up to libs/) and is an extends base. Its child
    // selects only a local file, so its own rootDir is its own directory;
    // pinned to "." it cannot inherit the base's "..", which would shift its
    // emit layout.
    write('libs/base/project.json', { name: 'base', root: 'libs/base' });
    write(
      'libs/base/src/index.ts',
      `import { b } from '@proj/b';\nexport const x = b;\n`
    );
    write('libs/base/main.ts', `export const m = 1;\n`);
    write('libs/base/tsconfig.json', {
      extends: '../../tsconfig.base.json',
      compilerOptions: { outDir: '../../dist/out-tsc' },
      include: ['src/**/*.ts'],
    });
    write('libs/base/tsconfig.child.json', {
      extends: './tsconfig.json',
      include: ['main.ts'],
    });

    await run();

    expect(rootDirOf('libs/base/tsconfig.json')).toBe('..');
    // Pinned to its own directory so it does not inherit the base's "..".
    expect(rootDirOf('libs/base/tsconfig.child.json')).toBe('.');
  });

  it('pins a composite child to its own directory instead of inheriting the base pin', async () => {
    // Same shape as above, but the child is composite. It is pinned to its own
    // directory (".") — its default under tsc, and the value ts-jest needs — so
    // it never inherits the ".." pinned on the base, which would shift its emit
    // layout.
    write('libs/comp-base/project.json', {
      name: 'comp-base',
      root: 'libs/comp-base',
    });
    write(
      'libs/comp-base/src/index.ts',
      `import { b } from '@proj/b';\nexport const x = b;\n`
    );
    write('libs/comp-base/main.ts', `export const m = 1;\n`);
    write('libs/comp-base/tsconfig.json', {
      extends: '../../tsconfig.base.json',
      compilerOptions: { outDir: '../../dist/out-tsc' },
      include: ['src/**/*.ts'],
    });
    write('libs/comp-base/tsconfig.child.json', {
      extends: './tsconfig.json',
      compilerOptions: { composite: true },
      include: ['main.ts'],
    });

    await run();

    expect(rootDirOf('libs/comp-base/tsconfig.json')).toBe('..');
    expect(rootDirOf('libs/comp-base/tsconfig.child.json')).toBe('.');
  });
});
