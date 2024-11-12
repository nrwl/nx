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
  stripIndents,
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
import {
  moduleFederationEnhancedVersion,
  nxVersion,
} from '../../utils/versions';
import { ensureProjectName } from '@nx/devkit/src/generators/project-name-and-root-utils';

export function addModuleFederationFiles(
  host: Tree,
  options: NormalizedSchema<Schema>
) {
  const templateVariables = {
    ...names(options.projectName),
    ...options,
    tmpl: '',
  };

  generateFiles(
    host,
    join(
      __dirname,
      `./files/${
        options.js
          ? options.bundler === 'rspack'
            ? 'rspack-common'
            : 'common'
          : 'common-ts'
      }`
    ),
    options.appProjectRoot,
    templateVariables
  );

  const pathToModuleFederationFiles = options.typescriptConfiguration
    ? `${
        options.bundler === 'rspack' ? 'rspack-' : 'webpack-'
      }module-federation-ts`
    : `${
        options.bundler === 'rspack' ? 'rspack-' : 'webpack-'
      }module-federation`;

  generateFiles(
    host,
    join(__dirname, `./files/${pathToModuleFederationFiles}`),
    options.appProjectRoot,
    templateVariables
  );

  if (options.typescriptConfiguration) {
    const pathToBundlerConfig = joinPathFragments(
      options.appProjectRoot,
      options.bundler === 'rspack' ? 'rspack.config.js' : 'webpack.config.js'
    );
    const pathToWebpackProdConfig = joinPathFragments(
      options.appProjectRoot,
      options.bundler === 'rspack'
        ? 'rspack.config.prod.js'
        : 'webpack.config.prod.js'
    );
    if (host.exists(pathToBundlerConfig)) {
      host.delete(pathToBundlerConfig);
    }
    if (host.exists(pathToWebpackProdConfig)) {
      host.delete(pathToWebpackProdConfig);
    }
  }
}

export async function remoteGenerator(host: Tree, schema: Schema) {
  const tasks: GeneratorCallback[] = [];
  const options: NormalizedSchema<Schema> = {
    ...(await normalizeOptions<Schema>(host, schema)),
    // when js is set to true, we want to use the js configuration
    js: schema.js ?? false,
    typescriptConfiguration: schema.js
      ? false
      : schema.typescriptConfiguration ?? true,
    dynamic: schema.dynamic ?? false,
    // TODO(colum): remove when MF works with Crystal
    addPlugin: false,
    bundler: schema.bundler ?? 'rspack',
  };

  if (options.dynamic) {
    // Dynamic remotes generate with library { type: 'var' } by default.
    // We need to ensure that the remote name is a valid variable name.
    const isValidRemote = isValidVariable(options.projectName);
    if (!isValidRemote.isValid) {
      throw new Error(
        `Invalid remote name provided: ${options.projectName}. ${isValidRemote.message}`
      );
    }
  }

  await ensureProjectName(host, options, 'application');
  const REMOTE_NAME_REGEX = '^[a-zA-Z_$][a-zA-Z_$0-9]*$';
  const remoteNameRegex = new RegExp(REMOTE_NAME_REGEX);
  if (!remoteNameRegex.test(options.projectName)) {
    throw new Error(
      stripIndents`Invalid remote name: ${options.projectName}. Remote project names must:
      - Start with a letter, dollar sign ($) or underscore (_)
      - Followed by any valid character (letters, digits, underscores, or dollar signs)
      The regular expression used is ${REMOTE_NAME_REGEX}.`
    );
  }
  const initAppTask = await applicationGenerator(host, {
    ...options,
    name: options.projectName,
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
    join(
      options.appProjectRoot,
      maybeJs(
        { js: options.js, useJsx: options.bundler === 'rspack' },
        'src/main.tsx'
      )
    ),
    join(
      options.appProjectRoot,
      maybeJs(
        { js: options.js, useJsx: options.bundler === 'rspack' },
        'src/bootstrap.tsx'
      )
    )
  );

  addModuleFederationFiles(host, options);
  updateModuleFederationProject(host, options);
  setupTspathForRemote(host, options);

  if (options.ssr) {
    const setupSsrTask = await setupSsrGenerator(host, {
      project: options.projectName,
      serverPort: options.devServerPort,
      skipFormat: true,
      bundler: options.bundler,
    });
    tasks.push(setupSsrTask);

    const setupSsrForRemoteTask = await setupSsrForRemote(
      host,
      options,
      options.projectName
    );
    tasks.push(setupSsrForRemoteTask);

    const projectConfig = readProjectConfiguration(host, options.projectName);
    if (options.bundler === 'rspack') {
      projectConfig.targets.server.executor = '@nx/rspack:rspack';
      projectConfig.targets.server.options.rspackConfig = joinPathFragments(
        projectConfig.root,
        `rspack.server.config.${options.typescriptConfiguration ? 'ts' : 'js'}`
      );
      delete projectConfig.targets.server.options.webpackConfig;
    } else {
      projectConfig.targets.server.options.webpackConfig = joinPathFragments(
        projectConfig.root,
        `webpack.server.config.${options.typescriptConfiguration ? 'ts' : 'js'}`
      );
    }
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
      options.projectName,
      options.devServerPort,
      pathToMFManifest
    );
  }

  addMfEnvToTargetDefaultInputs(host);

  const installTask = addDependenciesToPackageJson(
    host,
    {},
    {
      '@module-federation/enhanced': moduleFederationEnhancedVersion,
      '@nx/web': nxVersion,
    }
  );
  tasks.push(installTask);

  if (!options.skipFormat) {
    await formatFiles(host);
  }

  return runTasksInSerial(...tasks);
}

export default remoteGenerator;
