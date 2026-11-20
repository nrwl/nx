import { symlinkSync } from 'fs';
import { createTree } from 'nx/src/generators/testing-utils/create-tree';
import type { Tree } from 'nx/src/generators/tree';
import { TempFs } from 'nx/src/internal-testing-utils/temp-fs';
import { dirname, join } from 'path';

import { toJS } from './to-js';

describe('toJS', () => {
  let tree: Tree;
  beforeEach(() => {
    tree = createTree();
  });

  it('should renamed .ts and .tsx file to .js', () => {
    tree.write('a.ts', '// a');
    tree.write('b.tsx', '// b');

    toJS(tree);

    expect(tree.exists('a.ts')).toBeFalsy();
    expect(tree.exists('b.tsx')).toBeFalsy();
    expect(tree.read('a.js', 'utf-8')).toContain('// a');
    expect(tree.read('b.js', 'utf-8')).toContain('// b');
  });

  it('should support different extensions', () => {
    tree.write('a.ts', '// a');

    toJS(tree, {
      extension: '.mjs',
    });

    expect(tree.read('a.mjs', 'utf-8')).toContain('// a');
  });

  it('should rename .mts/.cts files alongside .ts', () => {
    tree.write('a.mts', '// a');
    tree.write('b.cts', '// b');

    toJS(tree, { extension: '.mjs' });

    expect(tree.exists('a.mts')).toBeFalsy();
    expect(tree.exists('b.cts')).toBeFalsy();
    expect(tree.read('a.mjs', 'utf-8')).toContain('// a');
    expect(tree.read('b.mjs', 'utf-8')).toContain('// b');
  });

  it('should support .jsx rather than .js files (for Vite)', () => {
    tree.write('a.ts', '// a');
    tree.write('b.tsx', '// b');

    toJS(tree, {
      useJsx: true,
    });

    expect(tree.read('a.js', 'utf-8')).toContain('// a');
    expect(tree.read('b.jsx', 'utf-8')).toContain('// b');
  });
});

describe('toJS with TypeScript 7.1', () => {
  let fs: TempFs;

  beforeEach(async () => {
    fs = new TempFs('to-js');
    fs.createDirSync('node_modules');
    symlinkSync(
      dirname(require.resolve('@typescript/native/package.json')),
      join(fs.tempDir, 'node_modules/typescript'),
      'dir'
    );
    vi.resetModules();
    // The vitest setup swaps ensurePackage for a require from this repo.
    vi.doUnmock('../utils/package-json');
    (await import('nx/src/utils/workspace-root')).setWorkspaceRoot(fs.tempDir);
    const { getTypescriptBackend } = await import('nx/src/devkit-internals');
    expect(getTypescriptBackend().kind).toBe('api');
  });

  afterEach(() => {
    fs.cleanup();
  });

  it('should transpile .ts and .tsx files', async () => {
    const { toJS } = await import('./to-js');
    const tree = createTree();
    tree.write('a.ts', 'export const a: number = 1;\n');
    tree.write('b.tsx', 'export const B = (): JSX.Element => <div />;\n');

    toJS(tree);

    expect(tree.read('a.js', 'utf-8')).toBe('export const a = 1;\n');
    expect(tree.read('b.js', 'utf-8')).toBe(
      'export const B = () => <div />;\n'
    );
  });
});
