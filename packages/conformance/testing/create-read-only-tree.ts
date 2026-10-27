import { workspaceRoot } from '@nx/devkit';
import {
  convertToReadOnly,
  ReadOnlyConformanceTree,
  WritableConformanceTree,
} from '../src/conformance-tree';
import { TempFs } from './temp-fs';

/**
 * Creates a read-only tree based on a new temporary directory, including some basic
 * files to make it a valid Nx workspace.
 *
 * The returned object contains the read-only tree and a cleanup function to remove the temporary directory,
 * intended for use in an `afterEach` hook or equivalent.
 *
 * An optional async callback can be provided to modify a writable version of the tree in any
 * way before the read only tree is returned.
 *
 * E.g.
 *
 * ```ts
 * // No callback is required
 * const { tree, cleanup } = await createReadOnlyTree();
 *
 * // ...but can optionally be provided
 * const { tree, cleanup } = await createReadOnlyTree(async (writableTree) => {
 *   // Add a file to the tree before it is converted to read only
 *   writableTree.write('foo.txt', 'foo');
 * });
 * ```
 *
 * See the `@nx/conformance` README.md for full details and examples of testing conformance rules.
 *
 * @public
 */
export async function createReadOnlyTree(
  cb?: (tree: WritableConformanceTree) => Promise<void>
): Promise<{
  tree: ReadOnlyConformanceTree;
  cleanup: () => void;
}> {
  // Implementation adapted from https://github.com/nrwl/nx/blob/b360446a51ba3b67b2baafc7cc97b26d0f7c8f24/packages/nx/src/generators/testing-utils/create-tree-with-empty-workspace.ts

  const tempFs = new TempFs('nx-conformance-create-read-only-tree');
  const tree = new WritableConformanceTree(tempFs.tempDir, false);

  // Needed for correct path resolution in the tree (the tempFs instance will have modified the workspaceRoot already)
  process.env.INIT_CWD = workspaceRoot;

  tree.write('./.prettierrc', JSON.stringify({ singleQuote: true }));
  tree.write(
    '/package.json',
    JSON.stringify({
      name: '@proj/source',
      dependencies: {},
      devDependencies: {},
    })
  );
  tree.write(
    '/nx.json',
    JSON.stringify({
      affected: {
        defaultBase: 'main',
      },
      targetDefaults: {
        build: {
          cache: true,
        },
        lint: {
          cache: true,
        },
      },
    })
  );
  tree.write(
    '/tsconfig.base.json',
    JSON.stringify({ compilerOptions: { paths: {} } })
  );

  // Allow the user to modify the tree before setting it as read only
  await cb?.(tree);

  return {
    tree: convertToReadOnly(tree),
    cleanup: () => tempFs.cleanup(),
  };
}
