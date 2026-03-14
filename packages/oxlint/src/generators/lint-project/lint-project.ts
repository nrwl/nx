import {
  formatFiles,
  GeneratorCallback,
  readNxJson,
  readProjectConfiguration,
  runTasksInSerial,
  Tree,
  updateProjectConfiguration,
} from '@nx/devkit';
import { initGenerator } from '../init/init';
import { hasOxlintPlugin } from '../../utils/plugin';

export interface LintProjectGeneratorSchema {
  project: string;
  skipFormat?: boolean;
  skipPackageJson?: boolean;
  keepExistingVersions?: boolean;
  addPlugin?: boolean;
  addExplicitTargets?: boolean;
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
    nxJson.useInferencePlugins !== false;
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

  const hasPlugin = hasOxlintPlugin(tree);
  if (!hasPlugin || options.addExplicitTargets) {
    projectConfig.targets ??= {};
    projectConfig.targets['oxlint'] = {
      executor: '@nx/oxlint:lint',
      options: {
        lintFilePatterns: ['{projectRoot}'],
      },
    };
  }

  updateProjectConfiguration(tree, options.project, projectConfig);

  if (!options.skipFormat) {
    await formatFiles(tree);
  }

  return runTasksInSerial(...tasks);
}

export default lintProjectGenerator;
