import {
  formatFiles,
  GeneratorCallback,
  readNxJson,
  readProjectConfiguration,
  runTasksInSerial,
  Tree,
  updateProjectConfiguration,
} from '@nx/devkit';
import { hasOxlintPlugin } from '../../utils/plugin.js';
import { initGenerator } from '../init/init.js';
import { addPluginsToOxlintConfig } from '../../utils/oxlint-config.js';

export interface LintProjectGeneratorSchema {
  project: string;
  skipFormat?: boolean;
  skipPackageJson?: boolean;
  keepExistingVersions?: boolean;
  addPlugin?: boolean;
  addExplicitTargets?: boolean;
  /** Oxlint plugins to enable for this project, e.g. `['react', 'jsx-a11y']`. */
  plugins?: string[];
}

export function lintProjectGenerator(
  tree: Tree,
  options: LintProjectGeneratorSchema
) {
  return lintProjectGeneratorInternal(tree, { addPlugin: false, ...options });
}

export async function lintProjectGeneratorInternal(
  tree: Tree,
  options: LintProjectGeneratorSchema
) {
  const nxJson = readNxJson(tree);
  const addPluginDefault =
    process.env.NX_ADD_PLUGINS !== 'false' &&
    nxJson?.useInferencePlugins !== false;
  options.addPlugin ??= addPluginDefault;

  const tasks: GeneratorCallback[] = [];
  tasks.push(
    await initGenerator(tree, {
      skipFormat: true,
      skipPackageJson: options.skipPackageJson,
      keepExistingVersions: options.keepExistingVersions,
      addPlugin: options.addPlugin,
    })
  );

  const projectConfig = readProjectConfiguration(tree, options.project);

  if (options.plugins?.length) {
    addPluginsToOxlintConfig(tree, projectConfig.root, options.plugins);
  }

  const hasPlugin = hasOxlintPlugin(tree);
  if (!hasPlugin || options.addExplicitTargets) {
    projectConfig.targets ??= {};
    // Prefer `lint`, the same name inference prefers, and step aside when
    // another linter already owns it.
    const targetName = projectConfig.targets['lint'] ? 'oxlint' : 'lint';
    projectConfig.targets[targetName] = {
      executor: '@nx/oxlint:lint',
      options: {
        lintFilePatterns: ['{projectRoot}'],
      },
    };
    updateProjectConfiguration(tree, options.project, projectConfig);
  }

  if (!options.skipFormat) {
    await formatFiles(tree);
  }

  return runTasksInSerial(...tasks);
}

export default lintProjectGenerator;
