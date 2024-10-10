import { ensurePackage, formatFiles, runTasksInSerial, Tree } from '@nx/devkit';
import { assertNotUsingTsSolutionSetup } from '@nx/js/src/utils/typescript/ts-solution-setup';
import { version as nxVersion } from 'nx/package.json';
import configurationGenerator from '../configuration/configuration';
import rspackInitGenerator from '../init/init';
import { normalizeOptions } from './lib/normalize-options';
import { ApplicationGeneratorSchema } from './schema';

export default async function (
  tree: Tree,
  _options: ApplicationGeneratorSchema
) {
  assertNotUsingTsSolutionSetup(tree, 'rspack', 'application');

  const tasks = [];
  const initTask = await rspackInitGenerator(tree, {
    ..._options,
    // TODO: Crystalize the default rspack.config.js file.
    // The default setup isn't crystalized so don't add plugin.
    addPlugin: false,
  });
  tasks.push(initTask);

  const options = await normalizeOptions(tree, _options);

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
    });
    tasks.push(createAppTask, convertAppTask);
  }

  await formatFiles(tree);

  return runTasksInSerial(...tasks);
}
