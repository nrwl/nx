import {
  GeneratorCallback,
  Tree,
  getProjects,
  joinPathFragments,
  runTasksInSerial,
  updateProjectConfiguration,
} from '@nx/devkit';
import webConfigurationGenerator from '../../generators/web-configuration/web-configuration';

/**
 * Add web configuration to react native projects
 * - delete the current serve target which is just a pass-through to start target
 * - rename the babel.config.json to to babel-v72.config.json
 * - add web confiugration, it will add .babelrc.js
 */
export default async function update(tree: Tree) {
  const projects = getProjects(tree);

  const tasks: GeneratorCallback[] = [];
  for (const [projectName, config] of projects.entries()) {
    if (config.targets?.['start']?.executor === '@nx/react-native:start') {
      if (
        config.targets['serve'] &&
        config.targets['serve'].executor === 'nx:run-commands' &&
        config.targets['serve'].options?.command?.startsWith('nx start')
      ) {
        delete config.targets['serve'];
        updateProjectConfiguration(tree, projectName, config);
      }

      if (tree.exists(joinPathFragments(config.root, 'babel.config.json'))) {
        tree.rename(
          joinPathFragments(config.root, 'babel.config.json'),
          joinPathFragments(config.root, 'babel-v72.config.json')
        );
      }

      tasks.push(
        await webConfigurationGenerator(tree, {
          project: config.name,
          bundler: 'webpack',
        })
      );
    }
  }
  return runTasksInSerial(...tasks);
}
