import { readJson, type Tree } from '@nx/devkit';
import { FsTree } from 'nx/src/generators/tree';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

import migration from './set-tsconfig-root-dir-for-ts6';

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

  it('writes rootDir once on a shared base when agreeing siblings collapse', async () => {
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

    // collapsed to the base, children inherit
    expect(rootDirOf('libs/col/tsconfig.json')).toBe('..');
    expect(rootDirOf('libs/col/tsconfig.lib.json')).toBeUndefined();
    expect(rootDirOf('libs/col/tsconfig.spec.json')).toBeUndefined();
  });
});
