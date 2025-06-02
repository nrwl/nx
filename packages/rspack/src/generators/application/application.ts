import {
  ensurePackage,
  formatFiles,
  logger,
  readNxJson,
  runTasksInSerial,
  Tree,
  updateNxJson,
} from '@nx/devkit';
import { version as nxVersion } from 'nx/package.json';
import configurationGenerator from '../configuration/configuration';
import rspackInitGenerator from '../init/init';
import { normalizeOptions } from './lib/normalize-options';
import { ApplicationGeneratorSchema, NormalizedSchema } from './schema';

/**
 * Updates the exclude field for any @nx/rspack/plugin registrations in nx.json
 */
function updateRspackPluginExclusion(tree: Tree, options: NormalizedSchema) {
  const nxJson = readNxJson(tree);
  if (!nxJson.plugins?.length) {
    return;
  }

  let updated = false;

  // Loop through all plugins to find @nx/rspack/plugin registrations
  for (let i = 0; i < nxJson.plugins.length; i++) {
    const plugin = nxJson.plugins[i];
    const isRspackPlugin =
      typeof plugin === 'string'
        ? plugin === '@nx/rspack/plugin'
        : plugin.plugin === '@nx/rspack/plugin';

    if (!isRspackPlugin) {
      continue;
    }

    if (typeof plugin === 'string') {
      // Convert string notation to object notation with exclude field
      nxJson.plugins[i] = {
        plugin: '@nx/rspack/plugin',
        exclude: [`${options.appProjectRoot}/**`],
      };
      updated = true;
    } else {
      // Object notation
      if (!plugin.exclude) {
        // Add exclude field if it doesn't exist
        plugin.exclude = [`${options.appProjectRoot}/**`];
        updated = true;
      } else if (Array.isArray(plugin.exclude)) {
        // Add to existing exclude field if it's an array
        plugin.exclude.push(`${options.appProjectRoot}/**`);
        updated = true;
      }
    }
  }

  if (updated) {
    updateNxJson(tree, nxJson);
  }
}

export default async function (
  tree: Tree,
  _options: ApplicationGeneratorSchema
) {
  // Add deprecation warning with alternatives based on framework
  const framework = _options.framework || 'react'; // Default is react

  logger.warn(
    `The @nx/rspack:application generator is deprecated and will be removed in Nx 22. ` +
      `Please use @nx/${
        framework === 'nest' ? 'nest' : framework === 'web' ? 'web' : 'react'
      }:application instead.`
  );

  const tasks = [];
  const initTask = await rspackInitGenerator(tree, {
    ..._options,
  });
  tasks.push(initTask);

  const options = await normalizeOptions(tree, _options);

  if (framework === 'nest') {
    updateRspackPluginExclusion(tree, options);
  }

  options.style ??= 'css';

  if (options.framework === 'nest') {
    const { applicationGenerator: nestAppGenerator } = ensurePackage(
      '@nx/nest',
      nxVersion
    );
    const createAppTask = await nestAppGenerator(tree, {
      ...options,
      skipFormat: true,
      tags: options.tags ?? '',
      addPlugin: false,
    });

    const convertAppTask = await configurationGenerator(tree, {
      project: options.name,
      target: 'node',
      newProject: false,
      buildTarget: 'build',
      framework: 'nest',
      addPlugin: false,
    });

    tasks.push(createAppTask, convertAppTask);
  } else if (options.framework === 'web') {
    const { applicationGenerator: webAppGenerator } = ensurePackage(
      '@nx/web',
      nxVersion
    );
    const createAppTask = await webAppGenerator(tree, {
      bundler: 'webpack',
      name: options.name,
      style: options.style,
      directory: options.directory,
      tags: options.tags ?? '',
      unitTestRunner: options.unitTestRunner,
      e2eTestRunner: options.e2eTestRunner,
      rootProject: options.rootProject,
      skipFormat: true,
      addPlugin: false,
    });
    const convertAppTask = await configurationGenerator(tree, {
      project: options.name,
      target: 'web',
      newProject: false,
      buildTarget: 'build',
      serveTarget: 'serve',
      framework: 'web',
      addPlugin: false,
    });
    tasks.push(createAppTask, convertAppTask);
  } else {
    // default to react
    const { applicationGenerator: reactAppGenerator } = ensurePackage(
      '@nx/react',
      nxVersion
    );
    const createAppTask = await reactAppGenerator(tree, {
      bundler: 'webpack',
      name: options.name,
      style: options.style,
      directory: options.directory,
      tags: options.tags ?? '',
      unitTestRunner: options.unitTestRunner,
      e2eTestRunner: options.e2eTestRunner,
      rootProject: options.rootProject,
      skipFormat: true,
      addPlugin: false,
    });
    const convertAppTask = await configurationGenerator(tree, {
      project: options.name,
      target: 'web',
      newProject: false,
      buildTarget: 'build',
      serveTarget: 'serve',
      framework: 'react',
      addPlugin: false,
    });
    tasks.push(createAppTask, convertAppTask);
  }

  await formatFiles(tree);

  return runTasksInSerial(...tasks);
}
