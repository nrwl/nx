import { FsTree } from '../tree';
import type { Tree } from '../tree';

/**
 * Creates a host for testing.
 */
export function createTreeWithEmptyWorkspace(
  opts = {} as { layout?: 'apps-libs' }
): Tree {
  const tree = new FsTree('/virtual', false);
  return addCommonFiles(tree, opts.layout === 'apps-libs');
}

/**
 * @deprecated use createTreeWithEmptyWorkspace instead
 */
export function createTreeWithEmptyV1Workspace(): Tree {
  throw new Error(
    'Use createTreeWithEmptyWorkspace instead of createTreeWithEmptyV1Workspace'
  );
}

function addCommonFiles(tree: Tree, addAppsAndLibsFolders: boolean): Tree {
  tree.write('./.prettierrc', JSON.stringify({ singleQuote: true }));
  tree.write(
    '/package.json',
    JSON.stringify({
      name: 'test-name',
      dependencies: {},
      devDependencies: {},
    })
  );
  tree.write(
    '/nx.json',
    JSON.stringify({
      npmScope: 'proj',
      affected: {
        defaultBase: 'main',
      },
      tasksRunnerOptions: {
        default: {
          runner: 'nx/tasks-runners/default',
          options: {
            cacheableOperations: ['build', 'lint', 'test', 'e2e'],
          },
        },
      },
    })
  );
  tree.write(
    '/tsconfig.base.json',
    JSON.stringify({ compilerOptions: { paths: {} } })
  );
  if (addAppsAndLibsFolders) {
    tree.write('/apps/.gitignore', '');
    tree.write('/libs/.gitignore', '');
  }
  return tree;
}
