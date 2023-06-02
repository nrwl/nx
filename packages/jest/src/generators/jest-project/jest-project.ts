import init from '../init/init';
import { checkForTestTarget } from './lib/check-for-test-target';
import { createFiles } from './lib/create-files';
import { updateTsConfig } from './lib/update-tsconfig';
import { updateWorkspace } from './lib/update-workspace';
import { JestProjectSchema, NormalizedJestProjectSchema } from './schema';
import {
  formatFiles,
  Tree,
  convertNxGenerator,
  GeneratorCallback,
  readProjectConfiguration,
} from '@nx/devkit';

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

export async function jestProjectGenerator(
  tree: Tree,
  schema: JestProjectSchema
): Promise<GeneratorCallback> {
  const options = normalizeOptions(tree, schema);
  const installTask = await init(tree, options);

  checkForTestTarget(tree, options);
  createFiles(tree, options);
  updateTsConfig(tree, options);
  updateWorkspace(tree, options);

  if (!schema.skipFormat) {
    await formatFiles(tree);
  }
  return installTask;
}

export const jestProjectSchematic = convertNxGenerator(jestProjectGenerator);
