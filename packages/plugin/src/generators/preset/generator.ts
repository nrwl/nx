import {
  formatFiles,
  GeneratorCallback,
  names,
  runTasksInSerial,
  Tree,
  updateJson,
} from '@nx/devkit';
import { Linter } from '@nx/eslint';
import { PackageJson } from 'nx/src/utils/package-json';
import { pluginGenerator } from '../plugin/plugin';
import { PresetGeneratorSchema } from './schema';
import createPackageGenerator from '../create-package/create-package';

export default async function (tree: Tree, options: PresetGeneratorSchema) {
  const tasks: GeneratorCallback[] = [];
  const pluginProjectName = names(
    options.pluginName.includes('/')
      ? options.pluginName.split('/')[1]
      : options.pluginName
  ).fileName;
  options.createPackageName =
    options.createPackageName === 'false' // for command line in e2e, it is passed as a string
      ? undefined
      : options.createPackageName;
  const pluginTask = await pluginGenerator(tree, {
    compiler: 'tsc',
    linter: Linter.EsLint,
    name: pluginProjectName,
    skipFormat: true,
    unitTestRunner: 'jest',
    importPath: options.pluginName,
    e2eTestRunner: 'jest',
    publishable: true,
    // when creating a CLI package, the plugin will be in the packages folder
    directory:
      options.createPackageName && options.createPackageName !== 'false'
        ? 'packages'
        : undefined,
    rootProject: options.createPackageName ? false : true,
  });
  tasks.push(pluginTask);

  moveNxPluginToDevDeps(tree);

  if (options.createPackageName) {
    const e2eProject = `${options.pluginName}-e2e`;
    const cliTask = await createPackageGenerator(tree, {
      directory: 'packages',
      name: options.createPackageName,
      e2eProject: e2eProject,
      project: options.pluginName,
      skipFormat: true,
      unitTestRunner: 'jest',
      linter: Linter.EsLint,
      compiler: 'tsc',
    });
    tasks.push(cliTask);
  }

  await formatFiles(tree);

  return runTasksInSerial(...tasks);
}
function moveNxPluginToDevDeps(tree: Tree) {
  updateJson<PackageJson>(tree, 'package.json', (json) => {
    const nxPluginEntry = json.dependencies['@nx/plugin'];
    delete json.dependencies['@nx/plugin'];
    json.devDependencies['@nx/plugin'] = nxPluginEntry;
    return json;
  });
}
