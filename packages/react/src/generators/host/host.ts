import {
  formatFiles,
  GeneratorCallback,
  joinPathFragments,
  readProjectConfiguration,
  runTasksInSerial,
  Tree,
  updateProjectConfiguration,
} from '@nx/devkit';

import applicationGenerator from '../application/application';
import { normalizeOptions } from '../application/lib/normalize-options';
import { updateModuleFederationProject } from '../../rules/update-module-federation-project';
import { addModuleFederationFiles } from './lib/add-module-federation-files';
import { updateModuleFederationE2eProject } from './lib/update-module-federation-e2e-project';

import { Schema } from './schema';
import remoteGenerator from '../remote/remote';

import setupSsrGenerator from '../setup-ssr/setup-ssr';
import { setupSsrForHost } from './lib/setup-ssr-for-host';

export async function hostGenerator(host: Tree, schema: Schema) {
  const tasks: GeneratorCallback[] = [];
  const options = normalizeOptions<Schema>(host, schema);

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
      remotesWithPorts.push({ name: remote, port: remotePort });
      await remoteGenerator(host, {
        name: remote,
        directory: options.directory,
        style: options.style,
        unitTestRunner: options.unitTestRunner,
        e2eTestRunner: options.e2eTestRunner,
        linter: options.linter,
        devServerPort: remotePort,
        ssr: options.ssr,
        skipFormat: true,
      });
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
      'webpack.server.config.js'
    );
    updateProjectConfiguration(host, options.projectName, projectConfig);
  }

  if (!options.skipFormat) {
    await formatFiles(host);
  }

  return runTasksInSerial(...tasks);
}

export default hostGenerator;
