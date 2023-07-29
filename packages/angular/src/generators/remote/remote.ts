import {
  extractLayoutDirectory,
  formatFiles,
  getProjects,
  runTasksInSerial,
  stripIndents,
  Tree,
} from '@nx/devkit';
import type { Schema } from './schema';
import applicationGenerator from '../application/application';
import { normalizeProjectName } from '../utils/project';
import { setupMf } from '../setup-mf/setup-mf';
import { E2eTestRunner } from '../../utils/test-runners';
import { addSsr, findNextAvailablePort } from './lib';

import { getInstalledAngularVersionInfo } from '../utils/version-utils';
import { lt } from 'semver';

export async function remote(tree: Tree, options: Schema) {
  const installedAngularVersionInfo = getInstalledAngularVersionInfo(tree);

  if (lt(installedAngularVersionInfo.version, '14.1.0') && options.standalone) {
    throw new Error(stripIndents`The "standalone" option is only supported in Angular >= 14.1.0. You are currently using ${installedAngularVersionInfo.version}.
    You can resolve this error by removing the "standalone" option or by migrating to Angular 14.1.0.`);
  }

  const projects = getProjects(tree);
  if (options.host && !projects.has(options.host)) {
    throw new Error(
      `The name of the application to be used as the host app does not exist. (${options.host})`
    );
  }

  const { projectDirectory } = extractLayoutDirectory(options.directory);
  const appName = normalizeProjectName(options.name, projectDirectory);
  const port = options.port ?? findNextAvailablePort(tree);

  const appInstallTask = await applicationGenerator(tree, {
    ...options,
    standalone: options.standalone ?? false,
    routing: true,
    port,
    skipFormat: true,
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
    prefix: options.prefix,
  });

  let installTasks = [appInstallTask];
  if (options.ssr) {
    let ssrInstallTask = await addSsr(tree, {
      appName,
      port,
      standalone: options.standalone,
    });
    installTasks.push(ssrInstallTask);
  }

  if (!options.skipFormat) {
    await formatFiles(tree);
  }

  return runTasksInSerial(...installTasks);
}

export default remote;
