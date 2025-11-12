import {
  formatFiles,
  GeneratorCallback,
  logger,
  readNxJson,
  readProjectConfiguration,
  runTasksInSerial,
  Tree,
  updateNxJson,
} from '@nx/devkit';
import { initGenerator as jsInitGenerator } from '@nx/js';
import { isUsingTsSolutionSetup } from '@nx/js/src/utils/typescript/ts-solution-setup';
import { JestPluginOptions } from '../../plugins/plugin.js';
import {
  findRootJestPreset,
  getPresetExt,
} from '../../utils/config/config-file.js';
import { jestInitGenerator } from '../init/init.js';
import { checkForTestTarget } from './lib/check-for-test-target.js';
import { createFiles } from './lib/create-files.js';
import { createJestConfig } from './lib/create-jest-config.js';
import { ensureDependencies } from './lib/ensure-dependencies.js';
import { updateTsConfig } from './lib/update-tsconfig.js';
import { updateVsCodeRecommendedExtensions } from './lib/update-vscode-recommended-extensions.js';
import { updateWorkspace } from './lib/update-workspace.js';
import { JestProjectSchema, NormalizedJestProjectSchema } from './schema.js';

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
    keepExistingVersions: options.keepExistingVersions ?? true,
    rootProject: project.root === '.' || project.root === '',
    isTsSolutionSetup: isUsingTsSolutionSetup(tree),
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

  // we'll only add the vscode recommended extension if the jest preset does
  // not exist, which most likely means this is a first run, in the cases it's
  // not a first run, we'll skip adding it but it's not a critical thing to do
  const shouldAddVsCodeRecommendations = findRootJestPreset(tree) === null;

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

  if (shouldAddVsCodeRecommendations) {
    updateVsCodeRecommendedExtensions(tree);
  }

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

  if (options.isTsSolutionSetup) {
    ignoreTestOutput(tree);

    // in the TS solution setup, the test target depends on the build outputs
    // so we need to setup the task pipeline accordingly
    const nxJson = readNxJson(tree);
    nxJson.targetDefaults ??= {};
    nxJson.targetDefaults[options.targetName] ??= {};
    nxJson.targetDefaults[options.targetName].dependsOn ??= [];
    nxJson.targetDefaults[options.targetName].dependsOn.push('^build');
    nxJson.targetDefaults[options.targetName].dependsOn = Array.from(
      new Set(nxJson.targetDefaults[options.targetName].dependsOn)
    );
    updateNxJson(tree, nxJson);
  }

  if (!schema.skipFormat) {
    await formatFiles(tree);
  }

  return runTasksInSerial(...tasks);
}

function ignoreTestOutput(tree: Tree): void {
  if (!tree.exists('.gitignore')) {
    logger.warn(`Couldn't find a root .gitignore file to update.`);
  }

  let content = tree.read('.gitignore', 'utf-8');
  if (/^test-output$/gm.test(content)) {
    return;
  }

  content = `${content}\ntest-output\n`;
  tree.write('.gitignore', content);
}

export default configurationGenerator;
