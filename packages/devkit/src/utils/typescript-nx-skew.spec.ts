import { createTree } from 'nx/src/generators/testing-utils/create-tree';
import { toJS } from '../generators/to-js';
import { rewriteDevkitDeepImports } from '../migrations/update-23-0-0/update-deep-imports';

// devkit's `nx` peer spans a major either side, and an nx without the
// TypeScript backend hands devkit `undefined` for its exports rather than a
// load failure.
vi.mock('nx/src/devkit-internals', async () => ({
  ...(await vi.importActual<any>('nx/src/devkit-internals')),
  getTypescriptAst: undefined,
  transpileTypescript: undefined,
}));

describe('devkit against an nx without the TypeScript backend', () => {
  it('loads the TypeScript module for devkit migrations', () => {
    expect(
      rewriteDevkitDeepImports(
        `import { names } from '@nx/devkit/src/utils/names';\n`
      )
    ).toBe(`import { names } from '@nx/devkit';\n`);
  });

  it('transpiles with the TypeScript module in toJS', () => {
    const tree = createTree();
    tree.write('a.ts', 'export const a: number = 1;\n');

    toJS(tree);

    expect(tree.read('a.js', 'utf-8')).toBe('export const a = 1;\n');
  });
});
