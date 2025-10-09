import {
  addDependenciesToPackageJson,
  formatFiles,
  GeneratorCallback,
  readNxJson,
  runTasksInSerial,
  Tree,
  updateNxJson,
} from '@nx/devkit';
import { nxVersion } from '../../utils/versions';
import { InitGeneratorSchema } from './schema';
import { hasDotNetPlugin } from '../../utils/has-dotnet-plugin';

export async function initGenerator(tree: Tree, options: InitGeneratorSchema) {
  const tasks: GeneratorCallback[] = [];

  if (!options.skipPackageJson && tree.exists('package.json')) {
    tasks.push(
      addDependenciesToPackageJson(
        tree,
        {},
        {
          '@nx/dotnet': nxVersion,
        },
        undefined,
        options.keepExistingVersions
      )
    );
  }

  addPlugin(tree);
  updateNxJsonConfiguration(tree);

  if (!options.skipFormat) {
    await formatFiles(tree);
  }

  return runTasksInSerial(...tasks);
}

function addPlugin(tree: Tree) {
  const nxJson = readNxJson(tree);

  if (!hasDotNetPlugin(tree)) {
    nxJson.plugins ??= [];
    nxJson.plugins.push({
      plugin: '@nx/dotnet',
      options: {
        buildTargetName: 'build',
        testTargetName: 'test',
        cleanTargetName: 'clean',
        restoreTargetName: 'restore',
        publishTargetName: 'publish',
        packTargetName: 'pack',
      },
    });
    updateNxJson(tree, nxJson);
  }
}

export function updateNxJsonConfiguration(tree: Tree) {
  const nxJson = readNxJson(tree);

  if (!nxJson.namedInputs) {
    nxJson.namedInputs = {};
  }

  // Default inputs include all project files
  const defaultFilesSet = nxJson.namedInputs.default ?? [];
  nxJson.namedInputs.default = Array.from(
    new Set([...defaultFilesSet, '{projectRoot}/**/*'])
  );

  // Production inputs exclude test files and build outputs
  const productionFileSet = nxJson.namedInputs.production ?? [];
  nxJson.namedInputs.production = Array.from(
    new Set([
      ...productionFileSet,
      'default',
      '!{projectRoot}/**/*.Tests/**/*',
      '!{projectRoot}/**/bin/**/*',
      '!{projectRoot}/**/obj/**/*',
    ])
  );

  updateNxJson(tree, nxJson);
}

export default initGenerator;
