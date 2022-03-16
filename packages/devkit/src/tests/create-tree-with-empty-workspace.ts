import { FsTree } from 'nx/src/shared/tree';
import type { Tree } from 'nx/src/shared/tree';

/**
 * Creates a host for testing.
 */
export function createTreeWithEmptyWorkspace(version = 1): Tree {
  const tree = new FsTree('/virtual', false);

  tree.write('/workspace.json', JSON.stringify({ version, projects: {} }));
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
