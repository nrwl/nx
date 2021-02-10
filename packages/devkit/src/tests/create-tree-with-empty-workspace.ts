import { FsTree } from '@nrwl/tao/src/shared/tree';

/**
 * Creates a host for testing.
 */
export function createTreeWithEmptyWorkspace() {
  const tree = new FsTree('/virtual', false);

  tree.write('/workspace.json', JSON.stringify({ version: 1, projects: {} }));
  tree.write('./.prettierrc', '{"singleQuote": true}');
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
      projects: {},
      affected: {
        defaultBase: 'master',
      },
      tasksRunnerOptions: {
        default: {
          runner: '@nrwl/workspace/tasks-runners/default',
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
