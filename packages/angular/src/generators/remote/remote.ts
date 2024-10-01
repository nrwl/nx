import {
  addDependenciesToPackageJson,
  formatFiles,
  getProjects,
  runTasksInSerial,
  Tree,
} from '@nx/devkit';
import {
  determineProjectNameAndRootOptions,
  ensureProjectName,
} from '@nx/devkit/src/generators/project-name-and-root-utils';
import { assertNotUsingTsSolutionSetup } from '@nx/js/src/utils/typescript/ts-solution-setup';
import { swcHelpersVersion } from '@nx/js/src/utils/versions';
import { E2eTestRunner } from '../../utils/test-runners';
import { applicationGenerator } from '../application/application';
import { setupMf } from '../setup-mf/setup-mf';
import { addMfEnvToTargetDefaultInputs } from '../utils/add-mf-env-to-inputs';
import { findNextAvailablePort, updateSsrSetup } from './lib';
import type { Schema } from './schema';

export async function remote(tree: Tree, schema: Schema) {
  assertNotUsingTsSolutionSetup(tree, 'angular', 'remote');

  const { typescriptConfiguration = true, ...options }: Schema = schema;
  options.standalone = options.standalone ?? true;

  const projects = getProjects(tree);
  if (options.host && !projects.has(options.host)) {
    throw new Error(
      `The name of the application to be used as the host app does not exist. (${options.host})`
    );
  }

  await ensureProjectName(tree, options, 'application');
  const { projectName: remoteProjectName } =
    await determineProjectNameAndRootOptions(tree, {
      name: options.name,
      projectType: 'application',
      directory: options.directory,
    });

  const port = options.port ?? findNextAvailablePort(tree);

  const appInstallTask = await applicationGenerator(tree, {
    ...options,
    standalone: options.standalone,
    routing: true,
    port,
    skipFormat: true,
    bundler: 'webpack',
  });

  const skipE2E =
    !options.e2eTestRunner || options.e2eTestRunner === E2eTestRunner.None;

  await setupMf(tree, {
    appName: remoteProjectName,
    mfType: 'remote',
    routing: true,
    host: options.host,
    port,
    skipPackageJson: options.skipPackageJson,
    skipFormat: true,
    skipE2E,
    e2eProjectName: skipE2E ? undefined : `${remoteProjectName}-e2e`,
    standalone: options.standalone,
    prefix: options.prefix,
    typescriptConfiguration,
    setParserOptionsProject: options.setParserOptionsProject,
  });

  const installTasks = [appInstallTask];
  if (!options.skipPackageJson) {
    const installSwcHelpersTask = addDependenciesToPackageJson(
      tree,
      {},
      {
        '@swc/helpers': swcHelpersVersion,
      }
    );
    installTasks.push(installSwcHelpersTask);
  }

  if (options.ssr) {
    let ssrInstallTask = await updateSsrSetup(tree, {
      appName: remoteProjectName,
      port,
      typescriptConfiguration,
      standalone: options.standalone,
      skipPackageJson: options.skipPackageJson,
    });
    installTasks.push(ssrInstallTask);
  }

  addMfEnvToTargetDefaultInputs(tree);

  if (!options.skipFormat) {
    await formatFiles(tree);
  }

  return runTasksInSerial(...installTasks);
}

export default remote;
