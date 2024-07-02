import { join } from 'path';
import {
  addDependenciesToPackageJson,
  formatFiles,
  generateFiles,
  GeneratorCallback,
  joinPathFragments,
  names,
  readProjectConfiguration,
  runTasksInSerial,
  Tree,
  updateProjectConfiguration,
} from '@nx/devkit';

import { normalizeOptions } from '../application/lib/normalize-options';
import applicationGenerator from '../application/application';
import { NormalizedSchema } from '../application/schema';
import { updateHostWithRemote } from './lib/update-host-with-remote';
import { updateModuleFederationProject } from '../../rules/update-module-federation-project';
import { Schema } from './schema';
import setupSsrGenerator from '../setup-ssr/setup-ssr';
import { setupSsrForRemote } from './lib/setup-ssr-for-remote';
import { setupTspathForRemote } from './lib/setup-tspath-for-remote';
import { addRemoteToDynamicHost } from './lib/add-remote-to-dynamic-host';
import { addMfEnvToTargetDefaultInputs } from '../../utils/add-mf-env-to-inputs';
import { maybeJs } from '../../utils/maybe-js';
import { isValidVariable } from '@nx/js';
import { moduleFederationEnhancedVersion } from '../../utils/versions';

export function addModuleFederationFiles(
  host: Tree,
  options: NormalizedSchema<Schema>
) {
  const templateVariables = {
    ...names(options.name),
    ...options,
    tmpl: '',
  };

  generateFiles(
    host,
    join(__dirname, `./files/${options.js ? 'common' : 'common-ts'}`),
    options.appProjectRoot,
    templateVariables
  );

  const pathToModuleFederationFiles = options.typescriptConfiguration
    ? 'module-federation-ts'
    : 'module-federation';

  generateFiles(
    host,
    join(__dirname, `./files/${pathToModuleFederationFiles}`),
    options.appProjectRoot,
    templateVariables
  );

  if (options.typescriptConfiguration) {
    const pathToWebpackConfig = joinPathFragments(
      options.appProjectRoot,
      'webpack.config.js'
    );
    const pathToWebpackProdConfig = joinPathFragments(
      options.appProjectRoot,
      'webpack.config.prod.js'
    );
    if (host.exists(pathToWebpackConfig)) {
      host.delete(pathToWebpackConfig);
    }
    if (host.exists(pathToWebpackProdConfig)) {
      host.delete(pathToWebpackProdConfig);
    }
  }
}

export async function remoteGenerator(host: Tree, schema: Schema) {
  return await remoteGeneratorInternal(host, {
    projectNameAndRootFormat: 'derived',
    ...schema,
  });
}

export async function remoteGeneratorInternal(host: Tree, schema: Schema) {
  const tasks: GeneratorCallback[] = [];
  const options: NormalizedSchema<Schema> = {
    ...(await normalizeOptions<Schema>(host, schema, '@nx/react:remote')),
    // when js is set to true, we want to use the js configuration
    js: schema.js ?? false,
    typescriptConfiguration: schema.js
      ? false
      : schema.typescriptConfiguration ?? true,
    dynamic: schema.dynamic ?? false,
    // TODO(colum): remove when MF works with Crystal
    addPlugin: false,
  };

  if (options.dynamic) {
    // Dynamic remotes generate with library { type: 'var' } by default.
    // We need to ensure that the remote name is a valid variable name.
    const isValidRemote = isValidVariable(options.name);
    if (!isValidRemote.isValid) {
      throw new Error(
        `Invalid remote name provided: ${options.name}. ${isValidRemote.message}`
      );
    }
  }

  const initAppTask = await applicationGenerator(host, {
    ...options,
    // Only webpack works with module federation for now.
    bundler: 'webpack',
    skipFormat: true,
  });
  tasks.push(initAppTask);

  if (schema.host) {
    updateHostWithRemote(host, schema.host, options.projectName);
  }

  // Module federation requires bootstrap code to be dynamically imported.
  // Renaming original entry file so we can use `import(./bootstrap)` in
  // new entry file.
  host.rename(
    join(options.appProjectRoot, maybeJs(options, 'src/main.tsx')),
    join(options.appProjectRoot, maybeJs(options, 'src/bootstrap.tsx'))
  );

  addModuleFederationFiles(host, options);
  updateModuleFederationProject(host, options);
  setupTspathForRemote(host, options);

  if (options.ssr) {
    const setupSsrTask = await setupSsrGenerator(host, {
      project: options.projectName,
      serverPort: options.devServerPort,
      skipFormat: true,
    });
    tasks.push(setupSsrTask);

    const setupSsrForRemoteTask = await setupSsrForRemote(
      host,
      options,
      options.projectName
    );
    tasks.push(setupSsrForRemoteTask);

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

  if (options.host && options.dynamic) {
    const hostConfig = readProjectConfiguration(host, schema.host);
    const pathToMFManifest = joinPathFragments(
      hostConfig.sourceRoot,
      'assets/module-federation.manifest.json'
    );
    addRemoteToDynamicHost(
      host,
      options.name,
      options.devServerPort,
      pathToMFManifest
    );
  }

  addMfEnvToTargetDefaultInputs(host);

  const installTask = addDependenciesToPackageJson(
    host,
    {},
    { '@module-federation/enhanced': moduleFederationEnhancedVersion }
  );
  tasks.push(installTask);

  if (!options.skipFormat) {
    await formatFiles(host);
  }

  return runTasksInSerial(...tasks);
}

export default remoteGenerator;
