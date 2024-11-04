import { createTree } from 'nx/src/generators/testing-utils/create-tree';
import type { Tree } from 'nx/src/generators/tree';

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
