import {
  formatFiles,
  names,
  runTasksInSerial,
  updateJson,
  type GeneratorCallback,
  type Tree,
} from '@nx/devkit';
import { createPackageGenerator } from '../create-package/create-package';
import { pluginGenerator } from '../plugin/plugin';
import type {
  NormalizedPresetGeneratorOptions,
  PresetGeneratorSchema,
} from './schema';
import { type PackageJson } from '@nx/devkit/internal';
import { normalizeLinterOption } from '@nx/js/internal';

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
  const options = await normalizeOptions(tree, rawOptions);

  const pluginTask = await pluginGenerator(tree, {
    compiler: 'tsc',
    linter: options.linter,
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
      linter: options.linter,
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

async function normalizeOptions(
  tree: Tree,
  options: PresetGeneratorSchema
): Promise<NormalizedPresetGeneratorOptions> {
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
    // Resolved once here rather than left to the two child generators, which
    // each prompt on their own and would ask the same question twice.
    linter: await normalizeLinterOption(tree, options.linter),
  };
}

export default presetGenerator;
