import { chain } from '@angular-devkit/schematics';
import {
  formatFiles,
  updateJsonInTree,
  updatePackagesInPackageJson,
} from '@nrwl/workspace';
import { join } from 'path';

const updatePackages = updatePackagesInPackageJson(
  join(__dirname, '../../../', 'migrations.json'),
  '9.2.0'
);

const addCacheableOperations = updateJsonInTree('nx.json', (nxJson) => {
  nxJson.tasksRunnerOptions = nxJson.tasksRunnerOptions || {};

  if (!nxJson.tasksRunnerOptions.default) {
    nxJson.tasksRunnerOptions.default = {
      runner: '@nrwl/workspace/tasks-runners/default',
      options: {
        cacheableOperations: ['build', 'lint', 'test', 'e2e'],
      },
    };

    return nxJson;
  } else if (
    nxJson.tasksRunnerOptions.default &&
    (nxJson.tasksRunnerOptions.default.runner ===
      '@nrwl/workspace/src/tasks-runner/default-task-runner' ||
      nxJson.tasksRunnerOptions.default.runner ===
        '@nrwl/workspace/src/tasks-runner/tasks-runner-v2')
  ) {
    nxJson.tasksRunnerOptions.default.runner =
      '@nrwl/workspace/tasks-runners/default';

    nxJson.tasksRunnerOptions.default.options =
      nxJson.tasksRunnerOptions.default.options || {};
    nxJson.tasksRunnerOptions.default.options.cacheableOperations =
      nxJson.tasksRunnerOptions.default.options.cacheableOperations || [];

    const cacheableOperations = new Set(
      nxJson.tasksRunnerOptions.default.options.cacheableOperations
    );
    cacheableOperations.add('build');
    cacheableOperations.add('lint');
    cacheableOperations.add('test');
    cacheableOperations.add('e2e');

    nxJson.tasksRunnerOptions.default.options.cacheableOperations =
      Array.from(cacheableOperations);

    return nxJson;
  }

  return nxJson;
});

export default function () {
  return chain([updatePackages, addCacheableOperations, formatFiles()]);
}
