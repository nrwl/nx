import {
  Tree,
  readJson,
  joinPathFragments,
  updateJson,
  updateNxJson,
  readNxJson,
} from '@nx/devkit';
import { Linter } from '@nx/linter';
import { PackageJson } from 'nx/src/utils/package-json';
import { pluginGenerator } from '../plugin/plugin';
import { PresetGeneratorSchema } from './schema';

export default async function (tree: Tree, options: PresetGeneratorSchema) {
  const task = await pluginGenerator(tree, {
    compiler: 'tsc',
    linter: Linter.EsLint,
    name: options.pluginName.includes('/')
      ? options.pluginName.split('/')[1]
      : options.pluginName,
    skipFormat: false,
    skipLintChecks: false,
    skipTsConfig: false,
    unitTestRunner: 'jest',
    importPath: options.pluginName,
    rootProject: true,
  });

  removeNpmScope(tree);
  moveNxPluginToDevDeps(tree);

  return task;
}

function removeNpmScope(tree: Tree) {
  updateNxJson(tree, { ...readNxJson(tree), npmScope: undefined });
}
function moveNxPluginToDevDeps(tree: Tree) {
  updateJson<PackageJson>(tree, 'package.json', (json) => {
    const nxPluginEntry = json.dependencies['@nx/nx-plugin'];
    delete json.dependencies['@nx/nx-plugin'];
    json.devDependencies['@nx/nx-plugin'] = nxPluginEntry;
    return json;
  });
}
