import {
  addDependenciesToPackageJson,
  formatFiles,
  getProjects,
  readProjectConfiguration,
  runTasksInSerial,
  stripIndents,
  Tree,
  updateProjectConfiguration,
} from '@nx/devkit';
import {
  determineProjectNameAndRootOptions,
  ensureRootProjectName,
} from '@nx/devkit/src/generators/project-name-and-root-utils';
import { assertNotUsingTsSolutionSetup } from '@nx/js/src/utils/typescript/ts-solution-setup';
import { swcHelpersVersion } from '@nx/js/src/utils/versions';
import { E2eTestRunner } from '../../utils/test-runners';
import { applicationGenerator } from '../application/application';
import { setupMf } from '../setup-mf/setup-mf';
import { addMfEnvToTargetDefaultInputs } from '../utils/add-mf-env-to-inputs';
import { findNextAvailablePort, updateSsrSetup } from './lib';
import type { Schema } from './schema';
import { assertRspackIsCSR } from '../utils/assert-mf-utils';
import convertToRspack from '../convert-to-rspack/convert-to-rspack';

export async function remote(tree: Tree, schema: Schema) {
  assertNotUsingTsSolutionSetup(tree, 'angular', 'remote');
  // TODO: Replace with Rspack when confidence is high enough
  schema.bundler ??= 'webpack';
  const isRspack = schema.bundler === 'rspack';
  assertRspackIsCSR(
    schema.bundler,
    schema.ssr ?? false,
    schema.serverRouting ?? false
  );

  const { typescriptConfiguration = true, ...options }: Schema = schema;
  options.standalone = options.standalone ?? true;

  const projects = getProjects(tree);
  if (options.host && !projects.has(options.host)) {
    throw new Error(
      `The name of the application to be used as the host app does not exist. (${options.host})`
    );
  }

  await ensureRootProjectName(options, 'application');
  const { projectName: remoteProjectName } =
    await determineProjectNameAndRootOptions(tree, {
      name: options.name,
      projectType: 'application',
      directory: options.directory,
    });

  const REMOTE_NAME_REGEX = '^[a-zA-Z_$][a-zA-Z_$0-9]*$';
  const remoteNameRegex = new RegExp(REMOTE_NAME_REGEX);
  if (!remoteNameRegex.test(remoteProjectName)) {
    throw new Error(
      stripIndents`Invalid remote name: ${remoteProjectName}. Remote project names must:
       - Start with a letter, dollar sign ($) or underscore (_)
       - Followed by any valid character (letters, digits, underscores, or dollar signs)
      The regular expression used is ${REMOTE_NAME_REGEX}.`
    );
  }
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

  if (isRspack) {
    await convertToRspack(tree, {
      project: remoteProjectName,
      skipInstall: options.skipPackageJson,
      skipFormat: true,
    });
  }

  const project = readProjectConfiguration(tree, remoteProjectName);
  project.targets.serve ??= {};
  project.targets.serve.options ??= {};
  if (options.host) {
    project.targets.serve.dependsOn ??= [];
    project.targets.serve.dependsOn.push(`${options.host}:serve`);
  }
  project.targets.serve.options.port = port;
  updateProjectConfiguration(tree, remoteProjectName, project);

  if (!options.skipFormat) {
    await formatFiles(tree);
  }

  return runTasksInSerial(...installTasks);
}

export default remote;
