import { FsTree } from 'nx/src/generators/tree';
import type { Tree } from 'nx/src/generators/tree';

/**
 * Creates a host for testing.
 */
export function createTreeWithEmptyWorkspace(): Tree {
  const tree = new FsTree('/virtual', false);
  tree.write('/workspace.json', JSON.stringify({ version: 2, projects: {} }));
  return addCommonFiles(tree);
}

export function createTreeWithEmptyV1Workspace(): Tree {
  const tree = new FsTree('/virtual', false);
  tree.write('/workspace.json', JSON.stringify({ version: 1, projects: {} }));
  return addCommonFiles(tree);
}

function addCommonFiles(tree: Tree): Tree {
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
  return tree;
}
