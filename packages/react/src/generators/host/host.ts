import {
  addDependenciesToPackageJson,
  detectPackageManager,
  formatFiles,
  GeneratorCallback,
  joinPathFragments,
  readJson,
  readProjectConfiguration,
  runTasksInSerial,
  Tree,
  updateJson,
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
} from '../../utils/normalize-remote';
import { setupSsrForHost } from './lib/setup-ssr-for-host';
import { updateModuleFederationE2eProject } from './lib/update-module-federation-e2e-project';
import { NormalizedSchema, Schema } from './schema';
import { addMfEnvToTargetDefaultInputs } from '../../utils/add-mf-env-to-inputs';
import { isValidVariable } from '@nx/js';
import { isUsingTsSolutionSetup } from '@nx/js/src/utils/typescript/ts-solution-setup';
import {
  moduleFederationEnhancedVersion,
  nxVersion,
} from '../../utils/versions';
import { ensureRootProjectName } from '@nx/devkit/src/generators/project-name-and-root-utils';
import { updateModuleFederationTsconfig } from './lib/update-module-federation-tsconfig';
import { normalizeHostName } from './lib/normalize-host-name';

export async function hostGenerator(
  host: Tree,
  schema: Schema
): Promise<GeneratorCallback> {
  const tasks: GeneratorCallback[] = [];
  const name = await normalizeHostName(host, schema.directory, schema.name);
  const options: NormalizedSchema = {
    ...(await normalizeOptions<Schema>(host, {
      ...schema,
      name,
    })),
    js: schema.js ?? false,
    typescriptConfiguration: schema.js
      ? false
      : schema.typescriptConfiguration ?? true,
    dynamic: schema.dynamic ?? false,
    // TODO(colum): remove when Webpack MF works with Crystal
    addPlugin: !schema.bundler || schema.bundler === 'rspack' ? true : false,
    bundler: schema.bundler ?? 'rspack',
  };

  // Check to see if remotes are provided and also check if --dynamic is provided
  // if both are check that the remotes are valid names else throw an error.
  if (options.dynamic && options.remotes?.length > 0) {
    options.remotes.forEach((remote) => {
      const isValidRemote = isValidVariable(remote);
      if (!isValidRemote.isValid) {
        throw new Error(
          `Invalid remote name provided: ${remote}. ${isValidRemote.message}`
        );
      }
    });
  }

  await ensureRootProjectName(options, 'application');
  const initTask = await applicationGenerator(host, {
    ...options,
    directory: options.appProjectRoot,
    name: options.name,
    // The target use-case is loading remotes as child routes, thus always enable routing.
    routing: true,
    skipFormat: true,
  });
  tasks.push(initTask);

  // In TS solution setup, update package.json to use simple name instead of scoped name
  if (isUsingTsSolutionSetup(host)) {
    const hostPackageJsonPath = joinPathFragments(
      options.appProjectRoot,
      'package.json'
    );
    if (host.exists(hostPackageJsonPath)) {
      updateJson(host, hostPackageJsonPath, (json) => {
        json.name = options.projectName;
        return json;
      });
    }
  }

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
        typescriptConfiguration: options.typescriptConfiguration,
        js: options.js,
        dynamic: options.dynamic,
        host: options.projectName,
        skipPackageJson: options.skipPackageJson,
        bundler: options.bundler,
      });
      tasks.push(remoteTask);
      remotePort++;
    }
  }

  addModuleFederationFiles(host, options, remotesWithPorts);
  updateModuleFederationProject(host, options, true);
  updateModuleFederationE2eProject(host, options);
  updateModuleFederationTsconfig(host, options);

  // Add remotes as devDependencies in TS solution setup
  if (isUsingTsSolutionSetup(host) && remotesWithPorts.length > 0) {
    addRemotesAsHostDependencies(host, options.projectName, remotesWithPorts);
  }

  if (options.ssr) {
    if (options.bundler !== 'rspack') {
      const setupSsrTask = await setupSsrGenerator(host, {
        project: options.projectName,
        serverPort: options.devServerPort,
        skipFormat: true,
      });
      tasks.push(setupSsrTask);
    }

    const setupSsrForHostTask = await setupSsrForHost(
      host,
      options,
      options.projectName,
      remotesWithPorts
    );
    tasks.push(setupSsrForHostTask);

    const projectConfig = readProjectConfiguration(host, options.projectName);
    if (options.bundler !== 'rspack') {
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

  addMfEnvToTargetDefaultInputs(host, options.bundler);

  const installTask = addDependenciesToPackageJson(
    host,
    { '@module-federation/enhanced': moduleFederationEnhancedVersion },
    {
      '@nx/web': nxVersion,
      '@nx/module-federation': nxVersion,
    }
  );
  tasks.push(installTask);

  if (!options.skipFormat) {
    await formatFiles(host);
  }

  return runTasksInSerial(...tasks);
}

function addRemotesAsHostDependencies(
  tree: Tree,
  hostName: string,
  remotes: { name: string; port: number }[]
) {
  const hostConfig = readProjectConfiguration(tree, hostName);
  const hostPackageJsonPath = joinPathFragments(
    hostConfig.root,
    'package.json'
  );

  if (!tree.exists(hostPackageJsonPath)) {
    throw new Error(
      `Host package.json not found at ${hostPackageJsonPath}. ` +
        `TypeScript solution setup requires package.json for all projects.`
    );
  }

  const packageManager = detectPackageManager(tree.root);
  const versionSpec = packageManager === 'npm' ? '*' : 'workspace:*';

  updateJson(tree, hostPackageJsonPath, (json) => {
    json.devDependencies ??= {};

    for (const remote of remotes) {
      // Use simple remote name directly to match module-federation.config.ts
      json.devDependencies[remote.name] = versionSpec;
    }

    return json;
  });
}

export default hostGenerator;
