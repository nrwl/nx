import { createTreeWithEmptyWorkspace } from 'nx/src/generators/testing-utils/create-tree-with-empty-workspace';
import type { Tree } from 'nx/src/generators/tree';
import { formatFiles } from './format-files';

// devkit's `nx` peer range spans three majors, so it runs against an nx that
// predates the formatter exports. Those reach `formatFiles` as `undefined`
// rather than as a load failure, and the presence checks there are the only
// thing standing between an older nx and a crash mid-generator.
jest.mock('nx/src/devkit-internals', () => {
  const actual = jest.requireActual('nx/src/devkit-internals');
  const {
    detectFormatter,
    detectFormatterInTree,
    formatFilesWithOxfmt,
    oxfmtConfigFiles,
    ...olderNx
  } = actual;
  return olderNx;
});

describe('formatFiles against an nx without the formatter exports', () => {
  let tree: Tree;

  it('guards the simulation itself', () => {
    // Without this the suite passes for the wrong reason: a mock that quietly
    // stopped applying would exercise the current nx and prove nothing.
    const seen = require('nx/src/devkit-internals');
    expect(seen.detectFormatterInTree).toBeUndefined();
    expect(seen.formatFilesWithOxfmt).toBeUndefined();
    expect(seen.isUsingPrettierInTree).toEqual(expect.any(Function));
  });

  it('still formats a prettier workspace through the fallback', async () => {
    tree = createTreeWithEmptyWorkspace({ formatter: 'prettier' });
    tree.write('test.ts', 'const   x   =   "hi"');

    await formatFiles(tree);

    expect(tree.read('test.ts', 'utf-8')).toBe("const x = 'hi';\n");
  });

  it('leaves a workspace with no formatter alone', async () => {
    tree = createTreeWithEmptyWorkspace({ formatter: 'none' });
    tree.write('test.ts', 'const   x   =   "hi"');

    await expect(formatFiles(tree)).resolves.toBeUndefined();
    expect(tree.read('test.ts', 'utf-8')).toBe('const   x   =   "hi"');
  });

  it('leaves an oxfmt workspace unformatted rather than throwing', async () => {
    // The pairing that has no answer: the workspace wants oxfmt and this nx
    // cannot drive it. Skipping is correct; throwing would break the generator.
    tree = createTreeWithEmptyWorkspace({ formatter: 'oxfmt' });
    tree.write('test.ts', 'const   x   =   "hi"');

    await expect(formatFiles(tree)).resolves.toBeUndefined();
    expect(tree.read('test.ts', 'utf-8')).toBe('const   x   =   "hi"');
  });

  it('still sorts tsconfig paths', async () => {
    // Sorting runs before formatter detection, so it must survive regardless.
    tree = createTreeWithEmptyWorkspace({ formatter: 'none' });
    tree.write(
      'tsconfig.base.json',
      JSON.stringify({
        compilerOptions: {
          paths: {
            '@z/lib': ['libs/z/index.ts'],
            '@a/lib': ['libs/a/index.ts'],
          },
        },
      })
    );

    await formatFiles(tree, { sortRootTsconfigPaths: true });

    const tsconfig = JSON.parse(tree.read('tsconfig.base.json', 'utf-8'));
    expect(Object.keys(tsconfig.compilerOptions.paths)).toEqual([
      '@a/lib',
      '@z/lib',
    ]);
  });
});
