import { FsTree } from '@nrwl/tao/src/shared/tree';
import { writeJson } from '../utils/json';

/**
 * Creates a host for testing.
 */
export function createTreeWithEmptyWorkspace() {
  const tree = new FsTree('/virtual', false);

  writeJson(tree, '/workspace.json', { version: 1, projects: {} });
  writeJson(tree, './.prettierrc', { singleQuote: true });
  writeJson(tree, '/package.json', {
    name: 'test-name',
    dependencies: {},
    devDependencies: {},
  });
  writeJson(tree, '/nx.json', {
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
  });
  writeJson(tree, '/tsconfig.base.json', { compilerOptions: { paths: {} } });

  return tree;
}
