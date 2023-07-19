import {
  convertNxGenerator,
  formatFiles,
  generateFiles,
  offsetFromRoot,
  readNxJson,
  readProjectConfiguration,
  toJS,
  Tree,
  updateNxJson,
  updateProjectConfiguration,
} from '@nx/devkit';
import * as path from 'path';
import { ConfigurationGeneratorSchema } from './schema';
import initGenerator from '../init/init';

export async function configurationGenerator(
  tree: Tree,
  options: ConfigurationGeneratorSchema
) {
  const projectConfig = readProjectConfiguration(tree, options.project);
  generateFiles(tree, path.join(__dirname, 'files'), projectConfig.root, {
    offsetFromRoot: offsetFromRoot(projectConfig.root),
    projectRoot: projectConfig.root,
    webServerCommand: options.webServerCommand ?? null,
    webServerAddress: options.webServerAddress ?? null,
    ...options,
  });

  addE2eTarget(tree, options);
  setupE2ETargetDefaults(tree);

  if (options.js) {
    toJS(tree);
  }
  if (!options.skipFormat) {
    await formatFiles(tree);
  }

  return initGenerator(tree, {
    skipFormat: true,
    skipPackageJson: options.skipPackageJson,
  });
}

function setupE2ETargetDefaults(tree: Tree) {
  const nxJson = readNxJson(tree);

  if (!nxJson.namedInputs) {
    return;
  }

  // E2e targets depend on all their project's sources + production sources of dependencies
  nxJson.targetDefaults ??= {};

  const productionFileSet = !!nxJson.namedInputs?.production;
  nxJson.targetDefaults.e2e ??= {};
  nxJson.targetDefaults.e2e.inputs ??= [
    'default',
    productionFileSet ? '^production' : '^default',
  ];

  updateNxJson(tree, nxJson);
}

function addE2eTarget(tree: Tree, options: ConfigurationGeneratorSchema) {
  const projectConfig = readProjectConfiguration(tree, options.project);
  if (projectConfig?.targets?.e2e) {
    throw new Error(`Project ${options.project} already has an e2e target.
Rename or remove the existing e2e target.`);
  }
  projectConfig.targets ??= {};
  projectConfig.targets.e2e = {
    executor: '@nx/playwright:playwright',
    outputs: [`dist/.playwright/${projectConfig.root}`],
    options: {
      config: `${projectConfig.root}/playwright.config.${
        options.js ? 'js' : 'ts'
      }`,
    },
  };
  updateProjectConfiguration(tree, options.project, projectConfig);
}

export default configurationGenerator;
export const configurationSchematic = convertNxGenerator(
  configurationGenerator
);
