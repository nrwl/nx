import {
  formatFiles,
  GeneratorCallback,
  output,
  readJson,
  readNxJson,
  readProjectConfiguration,
  runTasksInSerial,
  Tree,
} from '@nx/devkit';
import {
  getRootTsConfigFileName,
  initGenerator as jsInitGenerator,
} from '@nx/js';
import { JestPluginOptions } from '../../plugins/plugin';
import { getPresetExt } from '../../utils/config/config-file';
import { jestInitGenerator } from '../init/init';
import { checkForTestTarget } from './lib/check-for-test-target';
import { createFiles } from './lib/create-files';
import { createJestConfig } from './lib/create-jest-config';
import { ensureDependencies } from './lib/ensure-dependencies';
import { updateTsConfig } from './lib/update-tsconfig';
import { updateVsCodeRecommendedExtensions } from './lib/update-vscode-recommended-extensions';
import { updateWorkspace } from './lib/update-workspace';
import { JestProjectSchema, NormalizedJestProjectSchema } from './schema';

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

  tasks.push(getUnsupportedModuleResolutionWarningTask(tree));

  return runTasksInSerial(...tasks);
}

/**
 * For Jest < 30, there is no way to load jest.config.ts file if the tsconfig.json/tsconfig.base.json sets moduleResolution to bundler or nodenext.
 * Jest uses ts-node in a way that is not compatible, so until this is fixed we need to log a warning.
 * See: https://github.com/jestjs/jest/blob/main/packages/jest-config/src/readConfigFileAndSetRootDir.ts#L145-L153
 */
function getUnsupportedModuleResolutionWarningTask(
  tree: Tree
): GeneratorCallback {
  const tsConfigFileName = getRootTsConfigFileName(tree);
  if (tsConfigFileName) {
    const json = readJson(tree, tsConfigFileName);
    if (
      json.compilerOptions.moduleResolution !== 'node' &&
      json.compilerOptions.moduleResolution !== 'node10'
    ) {
      return () => {
        output.warn({
          title: `Compiler option 'moduleResolution' in ${tsConfigFileName} must be 'node' or 'node10'`,
          bodyLines: [
            `Jest requires 'moduleResolution' to be set to 'node' or 'node10' to work properly. It would need to be changed in the "${tsConfigFileName}" file. It's not enough to override the compiler option in the project's tsconfig file.`,
            `Alternatively, you can use the environment variable \`TS_NODE_COMPILER_OPTIONS='{"moduleResolution": "node10"}'\` to override Jest's usage of ts-node.`,
          ],
        });
      };
    }
  }

  return () => {};
}

export default configurationGenerator;
