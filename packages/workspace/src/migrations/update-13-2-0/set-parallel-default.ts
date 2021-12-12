import {
  formatFiles,
  readWorkspaceConfiguration,
  Tree,
  updateWorkspaceConfiguration,
} from '@nrwl/devkit';
import { output } from '../../utilities/output';

export async function setParallelDefault(host: Tree) {
  const config = readWorkspaceConfiguration(host);
  if (config.tasksRunnerOptions['default'].options.parallel) {
    config.tasksRunnerOptions['default'].options.parallel =
      config.tasksRunnerOptions['default'].options.maxParallel || 3;
    delete config.tasksRunnerOptions['default'].options.maxParallel;
  } else {
    config.tasksRunnerOptions['default'].options.parallel = 1;
  }
  updateWorkspaceConfiguration(host, config);
  await formatFiles(host);
}

export default setParallelDefault;
