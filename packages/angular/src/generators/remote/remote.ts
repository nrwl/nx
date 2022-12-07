import { formatFiles, getProjects, Tree } from '@nrwl/devkit';
import type { Schema } from './schema';
import applicationGenerator from '../application/application';
import { normalizeProjectName } from '../utils/project';
import { setupMf } from '../setup-mf/setup-mf';
import { E2eTestRunner } from '../../utils/test-runners';
import { addSsr, findNextAvailablePort } from './lib';
import { runTasksInSerial } from '@nrwl/workspace/src/utilities/run-tasks-in-serial';

export async function remote(tree: Tree, options: Schema) {
  const projects = getProjects(tree);
  if (options.host && !projects.has(options.host)) {
    throw new Error(
      `The name of the application to be used as the host app does not exist. (${options.host})`
    );
  }

  const appName = normalizeProjectName(options.name, options.directory);
  const port = options.port ?? findNextAvailablePort(tree);

  const appInstallTask = await applicationGenerator(tree, {
    ...options,
    routing: true,
    skipDefaultProject: true,
    port,
  });

  const skipE2E =
    !options.e2eTestRunner || options.e2eTestRunner === E2eTestRunner.None;

  await setupMf(tree, {
    appName,
    mfType: 'remote',
    routing: true,
    host: options.host,
    port,
    skipPackageJson: options.skipPackageJson,
    skipFormat: true,
    skipE2E,
    e2eProjectName: skipE2E ? undefined : `${appName}-e2e`,
    standalone: options.standalone,
  });

  let installTasks = [appInstallTask];
  if (options.ssr) {
    let ssrInstallTask = await addSsr(tree, { appName, port });
    installTasks.push(ssrInstallTask);
  }

  if (!options.skipFormat) {
    await formatFiles(tree);
  }

  return runTasksInSerial(...installTasks);
}

export default remote;
