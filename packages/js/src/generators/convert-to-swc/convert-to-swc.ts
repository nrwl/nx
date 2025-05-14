import {
  addDependenciesToPackageJson,
  installPackagesTask,
  ProjectConfiguration,
  readJson,
  readProjectConfiguration,
  Tree,
  updateProjectConfiguration,
} from '@nx/devkit';
import { join } from 'path';
import { addSwcConfig } from '../../utils/swc/add-swc-config';
import { addSwcDependencies } from '../../utils/swc/add-swc-dependencies';
import { swcHelpersVersion } from '../../utils/versions';
import { ConvertToSwcGeneratorSchema } from './schema';

export async function convertToSwcGenerator(
  tree: Tree,
  schema: ConvertToSwcGeneratorSchema
) {
  const options = normalizeOptions(schema);
  const projectConfiguration = readProjectConfiguration(tree, options.project);

  const updated = updateProjectBuildTargets(
    tree,
    projectConfiguration,
    options.project,
    options.targets
  );

  return updated ? checkSwcDependencies(tree, projectConfiguration) : () => {};
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
  let updated = false;
  for (const target of projectTargets) {
    const targetConfiguration = projectConfiguration.targets?.[target];
    if (!targetConfiguration || targetConfiguration.executor !== '@nx/js:tsc')
      continue;
    targetConfiguration.executor = '@nx/js:swc';
    updated = true;
  }

  if (updated) {
    updateProjectConfiguration(tree, projectName, projectConfiguration);
  }

  return updated;
}

function checkSwcDependencies(
  tree: Tree,
  projectConfiguration: ProjectConfiguration
) {
  const isSwcrcPresent = tree.exists(join(projectConfiguration.root, '.swcrc'));

  const packageJson = readJson(tree, 'package.json');
  const projectPackageJsonPath = join(
    projectConfiguration.root,
    'package.json'
  );
  const projectPackageJson = readJson(tree, projectPackageJsonPath);

  const hasSwcDependency =
    packageJson.dependencies && packageJson.dependencies['@swc/core'];

  const hasSwcHelpers =
    projectPackageJson.dependencies &&
    projectPackageJson.dependencies['@swc/helpers'];

  if (isSwcrcPresent && hasSwcDependency && hasSwcHelpers) return;

  if (!isSwcrcPresent) {
    addSwcConfig(tree, projectConfiguration.root);
  }

  if (!hasSwcDependency) {
    addSwcDependencies(tree);
  }

  if (!hasSwcHelpers) {
    addDependenciesToPackageJson(
      tree,
      { '@swc/helpers': swcHelpersVersion },
      {},
      projectPackageJsonPath
    );
  }

  return () => {
    if (!hasSwcDependency) {
      installPackagesTask(tree);
    }
  };
}

export default convertToSwcGenerator;
