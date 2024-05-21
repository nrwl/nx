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
import { JestPluginOptions } from '../../plugins/plugin';
import { getPresetExt } from '../../utils/config/config-file';

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

  const nxJson = readNxJson(tree);
  const addPlugin =
    process.env.NX_ADD_PLUGINS !== 'false' &&
    nxJson.useInferencePlugins !== false;

  options.addPlugin ??= addPlugin;

  options.targetName ??= 'test';

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

export function configurationGenerator(tree: Tree, schema: JestProjectSchema) {
  return configurationGeneratorInternal(tree, { addPlugin: false, ...schema });
}

export async function configurationGeneratorInternal(
  tree: Tree,
  schema: JestProjectSchema
): Promise<GeneratorCallback> {
  const options = normalizeOptions(tree, schema);

  const tasks: GeneratorCallback[] = [];

  tasks.push(await jsInitGenerator(tree, { ...schema, skipFormat: true }));
  tasks.push(await jestInitGenerator(tree, { ...options, skipFormat: true }));
  if (!schema.skipPackageJson) {
    tasks.push(ensureDependencies(tree, options));
  }

  const presetExt = getPresetExt(tree);

  await createJestConfig(tree, options, presetExt);
  checkForTestTarget(tree, options);
  createFiles(tree, options, presetExt);
  updateTsConfig(tree, options);
  updateVsCodeRecommendedExtensions(tree);

  const nxJson = readNxJson(tree);
  const hasPlugin = nxJson.plugins?.some((p) => {
    if (typeof p === 'string') {
      return p === '@nx/jest/plugin' && options.targetName === 'test';
    } else {
      return (
        p.plugin === '@nx/jest/plugin' &&
        ((p.options as JestPluginOptions)?.targetName ?? 'test') ===
          options.targetName
      );
    }
  });
  if (!hasPlugin || options.addExplicitTargets) {
    updateWorkspace(tree, options);
  }

  if (!schema.skipFormat) {
    await formatFiles(tree);
  }

  return runTasksInSerial(...tasks);
}

export default configurationGenerator;
