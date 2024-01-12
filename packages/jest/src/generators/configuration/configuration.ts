import { jestInitGenerator } from '../init/init';
import { checkForTestTarget } from './lib/check-for-test-target';
import { createFiles } from './lib/create-files';
import { createJestConfig } from './lib/create-jest-config';
import { ensureDependencies } from './lib/ensure-dependencies';
import { updateTsConfig } from './lib/update-tsconfig';
import { updateVsCodeRecommendedExtensions } from './lib/update-vscode-recommended-extensions';
import { updateWorkspace } from './lib/update-workspace';
import { JestProjectSchema, NormalizedJestProjectSchema } from './schema';
import {
  formatFiles,
  Tree,
  GeneratorCallback,
  readProjectConfiguration,
  readNxJson,
  runTasksInSerial,
} from '@nx/devkit';
import { initGenerator as jsInitGenerator } from '@nx/js';

const schemaDefaults = {
  setupFile: 'none',
  babelJest: false,
  supportTsx: false,
  skipSetupFile: false,
  skipSerializers: false,
  testEnvironment: 'jsdom',
} as const;

function normalizeOptions(
  tree: Tree,
  options: JestProjectSchema
): NormalizedJestProjectSchema {
  if (!options.testEnvironment) {
    options.testEnvironment = 'jsdom';
  }

  if (!options.hasOwnProperty('supportTsx')) {
    options.supportTsx = false;
  }

  // if we support TSX or compiler is not tsc, then we don't support angular(html templates)
  if (
    options.supportTsx ||
    options.babelJest ||
    ['swc', 'babel'].includes(options.compiler)
  ) {
    options.skipSerializers = true;
  }

  if (options.skipSetupFile) {
    // setupFile is always 'none'
    options.setupFile = schemaDefaults.setupFile;
  }

  const project = readProjectConfiguration(tree, options.project);

  return {
    ...schemaDefaults,
    ...options,
    rootProject: project.root === '.' || project.root === '',
  };
}

export async function configurationGenerator(
  tree: Tree,
  schema: JestProjectSchema
): Promise<GeneratorCallback> {
  const options = normalizeOptions(tree, schema);

  const tasks: GeneratorCallback[] = [];

  tasks.push(await jsInitGenerator(tree, { ...schema, skipFormat: true }));
  tasks.push(await jestInitGenerator(tree, options));
  if (!schema.skipPackageJson) {
    tasks.push(ensureDependencies(tree, options));
  }

  await createJestConfig(tree, options);
  checkForTestTarget(tree, options);
  createFiles(tree, options);
  updateTsConfig(tree, options);
  updateVsCodeRecommendedExtensions(tree);

  const nxJson = readNxJson(tree);
  const hasPlugin = nxJson.plugins?.some((p) =>
    typeof p === 'string'
      ? p === '@nx/jest/plugin'
      : p.plugin === '@nx/jest/plugin'
  );
  if (!hasPlugin) {
    updateWorkspace(tree, options);
  }

  if (!schema.skipFormat) {
    await formatFiles(tree);
  }

  return runTasksInSerial(...tasks);
}

export default configurationGenerator;
