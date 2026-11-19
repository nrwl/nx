import {
  formatFiles,
  GeneratorCallback,
  readProjectConfiguration,
  runTasksInSerial,
  Tree,
} from '@nx/devkit';
import { initGenerator } from '../init/init.js';
import { addPluginsToOxlintConfig } from '../../utils/oxlint-config.js';

export interface ConfigurationGeneratorSchema {
  project: string;
  skipFormat?: boolean;
  skipPackageJson?: boolean;
  keepExistingVersions?: boolean;
  /** Oxlint plugins to enable for this project, e.g. `['react', 'jsx-a11y']`. */
  plugins?: string[];
}

/**
 * Registers `@nx/oxlint` and enables this project's Oxlint plugins.
 *
 * It writes no target: `@nx/oxlint` is inference-only, so the plugin registered
 * by `init` is what gives the project its Oxlint task.
 */
export async function configurationGenerator(
  tree: Tree,
  options: ConfigurationGeneratorSchema
) {
  const tasks: GeneratorCallback[] = [];
  tasks.push(
    await initGenerator(tree, {
      skipFormat: true,
      skipPackageJson: options.skipPackageJson,
      keepExistingVersions: options.keepExistingVersions,
    })
  );

  // Read before the `plugins` check: `plugins` defaults to `[]`, so gating this
  // on it means a plain `--project=<typo>` run validates nothing and exits 0.
  const projectConfig = readProjectConfiguration(tree, options.project);

  if (options.plugins?.length) {
    addPluginsToOxlintConfig(tree, projectConfig.root, options.plugins);
  }

  if (!options.skipFormat) {
    await formatFiles(tree);
  }

  return runTasksInSerial(...tasks);
}

export default configurationGenerator;
