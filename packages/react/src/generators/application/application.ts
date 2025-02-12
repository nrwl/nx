import {
  formatFiles,
  GeneratorCallback,
  joinPathFragments,
  readNxJson,
  runTasksInSerial,
  Tree,
  updateNxJson,
} from '@nx/devkit';
import { initGenerator as jsInitGenerator } from '@nx/js';
import { logShowProjectCommand } from '@nx/devkit/src/utils/log-show-project-command';
import {
  addProjectToTsSolutionWorkspace,
  updateTsconfigFiles,
} from '@nx/js/src/utils/typescript/ts-solution-setup';
import { extractTsConfigBase } from '../../utils/create-ts-config';
import { addStyledModuleDependencies } from '../../rules/add-styled-dependencies';
import { setupTailwindGenerator } from '../setup-tailwind/setup-tailwind';
import reactInitGenerator from '../init/init';
import { createApplicationFiles } from './lib/create-application-files';
import { updateSpecConfig } from './lib/update-jest-config';
import { normalizeOptions } from './lib/normalize-options';
import { addProject } from './lib/add-project';
import { addJest } from './lib/add-jest';
import { addRouting } from './lib/add-routing';
import { setDefaults } from './lib/set-defaults';
import { addLinting } from './lib/add-linting';
import { addE2e } from './lib/add-e2e';
import { showPossibleWarnings } from './lib/show-possible-warnings';
import { installCommonDependencies } from './lib/install-common-dependencies';
import { initWebpack } from './lib/bundlers/add-webpack';
import {
  handleStyledJsxForRspack,
  initRspack,
  setupRspackConfiguration,
} from './lib/bundlers/add-rspack';
import {
  initRsbuild,
  setupRsbuildConfiguration,
} from './lib/bundlers/add-rsbuild';
import {
  setupViteConfiguration,
  setupVitestConfiguration,
} from './lib/bundlers/add-vite';
import { Schema } from './schema';
import { sortPackageJsonFields } from '@nx/js/src/utils/package-json/sort-fields';

export async function applicationGenerator(
  tree: Tree,
  schema: Schema
): Promise<GeneratorCallback> {
  return await applicationGeneratorInternal(tree, {
    addPlugin: false,
    ...schema,
  });
}

export async function applicationGeneratorInternal(
  tree: Tree,
  schema: Schema
): Promise<GeneratorCallback> {
  const tasks = [];

  const jsInitTask = await jsInitGenerator(tree, {
    ...schema,
    tsConfigName: schema.rootProject ? 'tsconfig.json' : 'tsconfig.base.json',
    skipFormat: true,
    addTsPlugin: schema.useTsSolution,
    formatter: schema.formatter,
    platform: 'web',
  });
  tasks.push(jsInitTask);

  const options = await normalizeOptions(tree, schema);

  // If we are using the new TS solution
  // We need to update the workspace file (package.json or pnpm-workspaces.yaml) to include the new project
  if (options.isUsingTsSolutionConfig) {
    addProjectToTsSolutionWorkspace(tree, options.appProjectRoot);
  }

  showPossibleWarnings(tree, options);

  const initTask = await reactInitGenerator(tree, {
    ...options,
    skipFormat: true,
  });
  tasks.push(initTask);

  if (!options.addPlugin) {
    const nxJson = readNxJson(tree);
    nxJson.targetDefaults ??= {};
    if (!Object.keys(nxJson.targetDefaults).includes('build')) {
      nxJson.targetDefaults.build = {
        cache: true,
        dependsOn: ['^build'],
      };
    } else if (!nxJson.targetDefaults.build.dependsOn) {
      nxJson.targetDefaults.build.dependsOn = ['^build'];
    }
    updateNxJson(tree, nxJson);
  }

  if (options.bundler === 'webpack') {
    await initWebpack(tree, options, tasks);
  } else if (options.bundler === 'rspack') {
    await initRspack(tree, options, tasks);
  } else if (options.bundler === 'rsbuild') {
    await initRsbuild(tree, options, tasks);
  }

  if (!options.rootProject) {
    extractTsConfigBase(tree);
  }

  await createApplicationFiles(tree, options);
  addProject(tree, options);

  if (options.style === 'tailwind') {
    const twTask = await setupTailwindGenerator(tree, {
      project: options.projectName,
    });
    tasks.push(twTask);
  }

  if (options.bundler === 'vite') {
    await setupViteConfiguration(tree, options, tasks);
  } else if (options.bundler === 'rspack') {
    await setupRspackConfiguration(tree, options, tasks);
  } else if (options.bundler === 'rsbuild') {
    await setupRsbuildConfiguration(tree, options, tasks);
  }

  if (options.bundler !== 'vite' && options.unitTestRunner === 'vitest') {
    await setupVitestConfiguration(tree, options, tasks);
  }

  if (
    (options.bundler === 'vite' || options.unitTestRunner === 'vitest') &&
    options.inSourceTests
  ) {
    tree.delete(
      joinPathFragments(
        options.appProjectRoot,
        `src/app/${options.fileName}.spec.tsx`
      )
    );
  }

  const lintTask = await addLinting(tree, options);
  tasks.push(lintTask);

  const e2eTask = await addE2e(tree, options);
  tasks.push(e2eTask);

  if (options.unitTestRunner === 'jest') {
    const jestTask = await addJest(tree, options);
    tasks.push(jestTask);
  }

  // Handle tsconfig.spec.json for jest or vitest
  updateSpecConfig(tree, options);
  const stylePreprocessorTask = await installCommonDependencies(tree, options);
  tasks.push(stylePreprocessorTask);
  const styledTask = addStyledModuleDependencies(tree, options);
  tasks.push(styledTask);
  const routingTask = addRouting(tree, options);
  tasks.push(routingTask);
  setDefaults(tree, options);

  if (options.bundler === 'rspack' && options.style === 'styled-jsx') {
    handleStyledJsxForRspack(tasks, tree, options);
  }

  updateTsconfigFiles(
    tree,
    options.appProjectRoot,
    'tsconfig.app.json',
    {
      jsx: 'react-jsx',
      module: 'esnext',
      moduleResolution: 'bundler',
    },
    options.linter === 'eslint'
      ? ['eslint.config.js', 'eslint.config.cjs', 'eslint.config.mjs']
      : undefined
  );

  sortPackageJsonFields(tree, options.appProjectRoot);

  if (!options.skipFormat) {
    await formatFiles(tree);
  }

  tasks.push(() => {
    logShowProjectCommand(options.projectName);
  });

  return runTasksInSerial(...tasks);
}

export default applicationGenerator;
