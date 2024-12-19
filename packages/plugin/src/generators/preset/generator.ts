import {
  formatFiles,
  names,
  readNxJson,
  runTasksInSerial,
  updateJson,
  type GeneratorCallback,
  type Tree,
} from '@nx/devkit';
import { isUsingTsSolutionSetup } from '@nx/js/src/utils/typescript/ts-solution-setup';
import type { PackageJson } from 'nx/src/utils/package-json';
import { createPackageGenerator } from '../create-package/create-package';
import { pluginGenerator } from '../plugin/plugin';
import type {
  NormalizedPresetGeneratorOptions,
  PresetGeneratorSchema,
} from './schema';

export async function presetGenerator(
  tree: Tree,
  rawOptions: PresetGeneratorSchema
) {
  return await presetGeneratorInternal(tree, {
    addPlugin: false,
    useProjectJson: true,
    ...rawOptions,
  });
}

export async function presetGeneratorInternal(
  tree: Tree,
  rawOptions: PresetGeneratorSchema
) {
  const tasks: GeneratorCallback[] = [];
  const options = normalizeOptions(tree, rawOptions);

  const pluginTask = await pluginGenerator(tree, {
    compiler: 'tsc',
    linter: 'eslint',
    skipFormat: true,
    unitTestRunner: 'jest',
    importPath: options.pluginName,
    e2eTestRunner: 'jest',
    publishable: true,
    // when creating a CLI package, the plugin will be in the packages folder
    directory:
      options.createPackageName && options.createPackageName !== 'false'
        ? `packages/${options.pluginName}`
        : options.pluginName,
    rootProject: options.createPackageName ? false : true,
    useProjectJson: options.useProjectJson,
    addPlugin: options.addPlugin,
  });
  tasks.push(pluginTask);

  moveNxPluginToDevDeps(tree);

  if (options.createPackageName) {
    const e2eProject = `${options.pluginName}-e2e`;
    const cliTask = await createPackageGenerator(tree, {
      directory: `packages/${options.createPackageName}`,
      name: options.createPackageName,
      e2eProject: e2eProject,
      project: options.pluginName,
      skipFormat: true,
      unitTestRunner: 'jest',
      linter: 'eslint',
      compiler: 'tsc',
      useProjectJson: options.useProjectJson,
      addPlugin: options.addPlugin,
    });
    tasks.push(cliTask);
  }

  await formatFiles(tree);

  return runTasksInSerial(...tasks);
}

function moveNxPluginToDevDeps(tree: Tree) {
  updateJson<PackageJson>(tree, 'package.json', (json) => {
    if (json.dependencies['@nx/plugin']) {
      const nxPluginEntry = json.dependencies['@nx/plugin'];
      delete json.dependencies['@nx/plugin'];
      json.devDependencies['@nx/plugin'] = nxPluginEntry;
    }
    return json;
  });
}

function normalizeOptions(
  tree: Tree,
  options: PresetGeneratorSchema
): NormalizedPresetGeneratorOptions {
  const isTsSolutionSetup = isUsingTsSolutionSetup(tree);

  const nxJson = readNxJson(tree);
  const addPlugin =
    options.addPlugin ??
    (isTsSolutionSetup &&
      process.env.NX_ADD_PLUGINS !== 'false' &&
      nxJson.useInferencePlugins !== false);

  return {
    ...options,
    pluginName: names(
      options.pluginName.includes('/')
        ? options.pluginName.split('/')[1]
        : options.pluginName
    ).fileName,
    createPackageName:
      options.createPackageName === 'false' // for command line in e2e, it is passed as a string
        ? undefined
        : options.createPackageName,
    addPlugin,
    useProjectJson: options.useProjectJson ?? !isTsSolutionSetup,
  };
}

export default presetGenerator;
