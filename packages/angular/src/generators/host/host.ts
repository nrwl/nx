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
import remoteGenerator from '../remote/remote';
import { normalizeProjectName } from '../utils/project';
import { setupMf } from '../setup-mf/setup-mf';
import { E2eTestRunner } from '../../utils/test-runners';
import { addSsr } from './lib';

import { getInstalledAngularVersionInfo } from '../utils/version-utils';
import { lt } from 'semver';

export async function host(tree: Tree, options: Schema) {
  const installedAngularVersionInfo = getInstalledAngularVersionInfo(tree);

  if (lt(installedAngularVersionInfo.version, '14.1.0') && options.standalone) {
    throw new Error(stripIndents`The "standalone" option is only supported in Angular >= 14.1.0. You are currently using ${installedAngularVersionInfo.version}.
    You can resolve this error by removing the "standalone" option or by migrating to Angular 14.1.0.`);
  }

  const projects = getProjects(tree);

  const remotesToGenerate: string[] = [];
  const remotesToIntegrate: string[] = [];

  if (options.remotes && options.remotes.length > 0) {
    options.remotes.forEach((remote) => {
      if (!projects.has(remote)) {
        remotesToGenerate.push(remote);
      } else {
        remotesToIntegrate.push(remote);
      }
    });
  }

  const { projectDirectory } = extractLayoutDirectory(options.directory);
  const appName = normalizeProjectName(options.name, projectDirectory);

  const appInstallTask = await applicationGenerator(tree, {
    ...options,
    standalone: options.standalone ?? false,
    routing: true,
    port: 4200,
    skipFormat: true,
  });

  const skipE2E =
    !options.e2eTestRunner || options.e2eTestRunner === E2eTestRunner.None;
  await setupMf(tree, {
    appName,
    mfType: 'host',
    routing: true,
    port: 4200,
    remotes: remotesToIntegrate ?? [],
    federationType: options.dynamic ? 'dynamic' : 'static',
    skipPackageJson: options.skipPackageJson,
    skipFormat: true,
    skipE2E,
    e2eProjectName: skipE2E ? undefined : `${appName}-e2e`,
    prefix: options.prefix,
  });

  let installTasks = [appInstallTask];
  if (options.ssr) {
    let ssrInstallTask = await addSsr(tree, options, appName);
    installTasks.push(ssrInstallTask);
  }

  for (const remote of remotesToGenerate) {
    await remoteGenerator(tree, {
      ...options,
      name: remote,
      host: appName,
      skipFormat: true,
      standalone: options.standalone,
    });
  }

  if (!options.skipFormat) {
    await formatFiles(tree);
  }

  return runTasksInSerial(...installTasks);
}

export default host;
