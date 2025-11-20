import { formatFiles, runTasksInSerial, Tree } from '@nx/devkit';
import { initGenerator as jsInitGenerator } from '@nx/js';

import detoxInitGenerator from '../init/init';
import { addGitIgnoreEntry } from './lib/add-git-ignore-entry';
import { addLinting } from './lib/add-linting';
import { addProject } from './lib/add-project';
import { createFiles } from './lib/create-files';
import { normalizeOptions } from './lib/normalize-options';
import { Schema } from './schema';
import { ensureDependencies } from './lib/ensure-dependencies';
import {
  addProjectToTsSolutionWorkspace,
  shouldConfigureTsSolutionSetup,
  updateTsconfigFiles,
} from '@nx/js/src/utils/typescript/ts-solution-setup';
import { sortPackageJsonFields } from '@nx/js/src/utils/package-json/sort-fields';

export async function detoxApplicationGenerator(host: Tree, schema: Schema) {
  return await detoxApplicationGeneratorInternal(host, {
    addPlugin: false,
    useProjectJson: true,
    ...schema,
  });
}

export async function detoxApplicationGeneratorInternal(
  host: Tree,
  schema: Schema
) {
  const addTsPlugin = shouldConfigureTsSolutionSetup(host, schema.addPlugin);
  const jsInitTask = await jsInitGenerator(host, {
    addTsPlugin,
    skipFormat: true,
  });

  const options = await normalizeOptions(host, schema);

  const initTask = await detoxInitGenerator(host, {
    ...options,
    skipFormat: true,
  });
  createFiles(host, options);
  addProject(host, options);
  addGitIgnoreEntry(host, options);

  const lintingTask = await addLinting(host, options);
  const depsTask = ensureDependencies(host, options);

  updateTsconfigFiles(
    host,
    options.e2eProjectRoot,
    'tsconfig.json',
    {
      module: 'esnext',
      moduleResolution: 'bundler',
      outDir: 'out-tsc/detox',
      allowJs: true,
      types: ['node', 'jest', 'detox'],
    },
    options.linter === 'eslint'
      ? ['eslint.config.js', 'eslint.config.cjs', 'eslint.config.mjs']
      : undefined
  );

  if (options.isUsingTsSolutionConfig) {
    await addProjectToTsSolutionWorkspace(host, options.e2eProjectRoot);
  }

  sortPackageJsonFields(host, options.e2eProjectRoot);

  if (!options.skipFormat) {
    await formatFiles(host);
  }

  return runTasksInSerial(jsInitTask, initTask, lintingTask, depsTask);
}

export default detoxApplicationGenerator;
