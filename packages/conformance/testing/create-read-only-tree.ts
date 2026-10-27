import { workspaceRoot } from '@nx/devkit';
import { setWorkspaceRoot } from '@nx/devkit/internal';
import { mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  convertToReadOnly,
  ReadOnlyConformanceTree,
  WritableConformanceTree,
} from '../src/conformance-tree';

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
  const previousWorkspaceRoot = workspaceRoot;
  const tempDir = realpathSync(
    mkdtempSync(join(tmpdir(), 'nx-conformance-create-read-only-tree'))
  );
  writeFileSync(join(tempDir, 'nx.json'), '{}');
  setWorkspaceRoot(tempDir);
  process.env.INIT_CWD = tempDir;

  const tree = new WritableConformanceTree(tempDir, false);

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
    cleanup: () => {
      rmSync(tempDir, { recursive: true, force: true });
      setWorkspaceRoot(previousWorkspaceRoot);
    },
  };
}
