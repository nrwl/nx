import { createTreeWithEmptyWorkspace } from 'nx/src/generators/testing-utils/create-tree-with-empty-workspace';
import type { Tree } from 'nx/src/generators/tree';
import { formatFiles } from './format-files';

// devkit's `nx` peer range spans three majors, so it runs against an nx that
// predates the formatter exports. Those reach `formatFiles` as `undefined`
// rather than as a load failure, so what stands between an older nx and a
// crash mid-generator is the `detectFormatterInTree` presence check. The one in
// `formatWithOxfmt` is not reachable from here - see the oxfmt case below.

const mockIsUsingPrettierInTree = jest.fn();

jest.mock('nx/src/devkit-internals', () => {
  const actual = jest.requireActual('nx/src/devkit-internals');
  const {
    detectFormatter,
    detectFormatterInTree,
    formatFilesWithOxfmt,
    oxfmtConfigFiles,
    ...olderNx
  } = actual;
  return {
    ...olderNx,
    isUsingPrettierInTree: (...args: unknown[]) =>
      mockIsUsingPrettierInTree(...args),
  };
});

describe('formatFiles against an nx without the formatter exports', () => {
  let tree: Tree;

  beforeEach(() => {
    const { isUsingPrettierInTree } = jest.requireActual(
      'nx/src/devkit-internals'
    );
    mockIsUsingPrettierInTree
      .mockReset()
      .mockImplementation(isUsingPrettierInTree);
  });

  it('guards the simulation itself', () => {
    // Without this the suite passes for the wrong reason: a mock that quietly
    // stopped applying would exercise the current nx and prove nothing.
    const seen = require('nx/src/devkit-internals');
    expect(seen.detectFormatterInTree).toBeUndefined();
    expect(seen.formatFilesWithOxfmt).toBeUndefined();
    expect(seen.isUsingPrettierInTree).toEqual(expect.any(Function));
  });

  it('still selects prettier through the fallback', async () => {
    // Asserts the branch was taken, not its output. Whether prettier can
    // actually format under jest depends on whether its dynamic `import()` is
    // reachable, which varies between an isolated run and the full suite - so
    // the formatted text is not a stable signal. That the fallback consulted
    // prettier detection, and that detection said yes, is.
    tree = createTreeWithEmptyWorkspace({ formatter: 'prettier' });
    tree.write('test.ts', 'const   x   =   "hi"');

    await formatFiles(tree);

    expect(mockIsUsingPrettierInTree).toHaveBeenCalledWith(tree);
    expect(mockIsUsingPrettierInTree.mock.results[0].value).toBe(true);
  });

  it('leaves a workspace with no formatter alone', async () => {
    tree = createTreeWithEmptyWorkspace({ formatter: 'none' });
    tree.write('test.ts', 'const   x   =   "hi"');

    await expect(formatFiles(tree)).resolves.toBeUndefined();
    expect(tree.read('test.ts', 'utf-8')).toBe('const   x   =   "hi"');
  });

  it('leaves an oxfmt workspace unformatted rather than throwing', async () => {
    // With `detectFormatterInTree` gone the fallback can only ever answer
    // `prettier`, so `formatWithOxfmt` - and its own presence check - is never
    // reached. What this pins is the fallback returning null for a workspace it
    // cannot recognise, which is why the file is left alone rather than thrown on.
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
