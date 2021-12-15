import {
  convertNxGenerator,
  installPackagesTask,
  ProjectConfiguration,
  readJson,
  readProjectConfiguration,
  Tree,
  updateProjectConfiguration,
} from '@nrwl/devkit';
import { join } from 'path';
import { addSwcConfig } from '../../utils/swc/add-swc-config';
import { addSwcDependencies } from '../../utils/swc/add-swc-dependencies';
import { ConvertToSwcGeneratorSchema } from './schema';

export async function convertToSwcGenerator(
  tree: Tree,
  schema: ConvertToSwcGeneratorSchema
) {
  const options = normalizeOptions(schema);
  const projectConfiguration = readProjectConfiguration(tree, options.name);

  updateProjectBuildTargets(
    tree,
    projectConfiguration,
    options.name,
    options.targets
  );

  return checkSwcDependencies(tree, projectConfiguration);
}

function normalizeOptions(
  schema: ConvertToSwcGeneratorSchema
): ConvertToSwcGeneratorSchema {
  const options = { ...schema };

  if (!options.targets) {
    options.targets = ['build'];
  }

  return options;
}

function updateProjectBuildTargets(
  tree: Tree,
  projectConfiguration: ProjectConfiguration,
  projectName: string,
  projectTargets: string[]
) {
  for (const target of projectTargets) {
    const targetConfiguration = projectConfiguration.targets[target];
    if (!targetConfiguration || targetConfiguration.executor !== '@nrwl/js:tsc')
      continue;
    targetConfiguration.executor = '@nrwl/js:swc';
  }

  updateProjectConfiguration(tree, projectName, projectConfiguration);
}

function checkSwcDependencies(
  tree: Tree,
  projectConfiguration: ProjectConfiguration
) {
  const isSwcrcPresent = tree.exists(join(projectConfiguration.root, '.swcrc'));

  const packageJson = readJson(tree, 'package.json');
  const hasSwcDependency =
    packageJson.dependencies && packageJson.dependencies['@swc/core'];

  if (isSwcrcPresent && hasSwcDependency) return;

  if (!isSwcrcPresent) {
    addSwcConfig(tree, projectConfiguration.root);
  }

  if (!hasSwcDependency) {
    addSwcDependencies(tree);
  }

  return () => {
    if (!hasSwcDependency) {
      installPackagesTask(tree);
    }
  };
}

export default convertToSwcGenerator;
export const convertToSwcSchematic = convertNxGenerator(convertToSwcGenerator);
