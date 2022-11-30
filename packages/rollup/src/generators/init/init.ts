import {
  addDependenciesToPackageJson,
  convertNxGenerator,
  formatFiles,
  GeneratorCallback,
  readWorkspaceConfiguration,
  Tree,
  updateWorkspaceConfiguration,
  writeJson,
} from '@nrwl/devkit';
import { Schema } from './schema';
import { swcCoreVersion, swcHelpersVersion } from '@nrwl/js/src/utils/versions';
import { swcLoaderVersion, tsLibVersion } from '../../utils/versions';

export async function rollupInitGenerator(tree: Tree, schema: Schema) {
  let task: GeneratorCallback;

  if (schema.compiler === 'babel') {
    initRootBabelConfig(tree);
  }

  if (schema.compiler === 'swc') {
    task = addDependenciesToPackageJson(
      tree,
      {},
      {
        '@swc/helpers': swcHelpersVersion,
        '@swc/core': swcCoreVersion,
        'swc-loader': swcLoaderVersion,
      }
    );
  } else {
    task = addDependenciesToPackageJson(tree, {}, { tslib: tsLibVersion });
  }

  if (!schema.skipFormat) {
    await formatFiles(tree);
  }

  return task;
}

function initRootBabelConfig(tree: Tree) {
  if (tree.exists('/babel.config.json') || tree.exists('/babel.config.js')) {
    return;
  }

  writeJson(tree, '/babel.config.json', {
    babelrcRoots: ['*'], // Make sure .babelrc files other than root can be loaded in a monorepo
  });

  const workspaceConfiguration = readWorkspaceConfiguration(tree);

  if (workspaceConfiguration.namedInputs?.sharedGlobals) {
    workspaceConfiguration.namedInputs.sharedGlobals.push(
      '{workspaceRoot}/babel.config.json'
    );
  }
  updateWorkspaceConfiguration(tree, workspaceConfiguration);
}

export default rollupInitGenerator;

export const rollupInitSchematic = convertNxGenerator(rollupInitGenerator);
