import {
  formatFiles,
  GeneratorCallback,
  joinPathFragments,
  readProjectConfiguration,
  runTasksInSerial,
  Tree,
  updateProjectConfiguration,
} from '@nx/devkit';
import { updateModuleFederationProject } from '../../rules/update-module-federation-project';
import applicationGenerator from '../application/application';
import { normalizeOptions } from '../application/lib/normalize-options';
import remoteGenerator from '../remote/remote';
import setupSsrGenerator from '../setup-ssr/setup-ssr';
import { addModuleFederationFiles } from './lib/add-module-federation-files';
import {
  normalizeRemoteDirectory,
  normalizeRemoteName,
} from './lib/normalize-remote';
import { setupSsrForHost } from './lib/setup-ssr-for-host';
import { updateModuleFederationE2eProject } from './lib/update-module-federation-e2e-project';
import { NormalizedSchema, Schema } from './schema';
import { addMfEnvToTargetDefaultInputs } from '../../utils/add-mf-env-to-inputs';

export async function hostGenerator(
  host: Tree,
  schema: Schema
): Promise<GeneratorCallback> {
  return hostGeneratorInternal(host, {
    projectNameAndRootFormat: 'derived',
    ...schema,
  });
}

export async function hostGeneratorInternal(
  host: Tree,
  schema: Schema
): Promise<GeneratorCallback> {
  const tasks: GeneratorCallback[] = [];
  const options: NormalizedSchema = {
    ...(await normalizeOptions<Schema>(host, schema, '@nx/react:host')),
    js: schema.js ?? false,
    typescriptConfiguration: schema.js
      ? false
      : schema.typescriptConfiguration ?? true,
    dynamic: schema.dynamic ?? false,
    // TODO(colum): remove when MF works with Crystal
    addPlugin: false,
  };

  const initTask = await applicationGenerator(host, {
    ...options,
    // The target use-case is loading remotes as child routes, thus always enable routing.
    routing: true,
    // Only webpack works with module federation for now.
    bundler: 'webpack',
    skipFormat: true,
  });
  tasks.push(initTask);

  const remotesWithPorts: { name: string; port: number }[] = [];

  if (schema.remotes) {
    let remotePort = options.devServerPort + 1;
    for (const remote of schema.remotes) {
      const remoteName = await normalizeRemoteName(host, remote, options);
      remotesWithPorts.push({ name: remoteName, port: remotePort });

      const remoteTask = await remoteGenerator(host, {
        name: remote,
        directory: normalizeRemoteDirectory(remote, options),
        style: options.style,
        unitTestRunner: options.unitTestRunner,
        e2eTestRunner: options.e2eTestRunner,
        linter: options.linter,
        devServerPort: remotePort,
        ssr: options.ssr,
        skipFormat: true,
        projectNameAndRootFormat: options.projectNameAndRootFormat,
        typescriptConfiguration: options.typescriptConfiguration,
        js: options.js,
        dynamic: options.dynamic,
        host: options.name,
      });
      tasks.push(remoteTask);
      remotePort++;
    }
  }

  addModuleFederationFiles(host, options, remotesWithPorts);
  updateModuleFederationProject(host, options);
  updateModuleFederationE2eProject(host, options);

  if (options.ssr) {
    const setupSsrTask = await setupSsrGenerator(host, {
      project: options.projectName,
      serverPort: options.devServerPort,
      skipFormat: true,
    });
    tasks.push(setupSsrTask);

    const setupSsrForHostTask = await setupSsrForHost(
      host,
      options,
      options.projectName,
      remotesWithPorts
    );
    tasks.push(setupSsrForHostTask);

    const projectConfig = readProjectConfiguration(host, options.projectName);
    projectConfig.targets.server.options.webpackConfig = joinPathFragments(
      projectConfig.root,
      `webpack.server.config.${options.typescriptConfiguration ? 'ts' : 'js'}`
    );
    updateProjectConfiguration(host, options.projectName, projectConfig);
  }

  if (!options.setParserOptionsProject) {
    host.delete(
      joinPathFragments(options.appProjectRoot, 'tsconfig.lint.json')
    );
  }

  addMfEnvToTargetDefaultInputs(host);

  if (!options.skipFormat) {
    await formatFiles(host);
  }

  return runTasksInSerial(...tasks);
}

export default hostGenerator;
