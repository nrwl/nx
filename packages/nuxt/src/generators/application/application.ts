import * as path from 'path';
import {
  addProjectConfiguration,
  ensurePackage,
  formatFiles,
  generateFiles,
  GeneratorCallback,
  offsetFromRoot,
  runTasksInSerial,
  toJS,
  Tree,
} from '@nx/devkit';
import { Schema } from './schema';
import nuxtInitGenerator from '../init/init';
import { normalizeOptions } from './lib/normalize-options';
import { createTsConfig } from '../../utils/create-ts-config';
import { getRelativePathToRootTsConfig } from '@nx/js';
import { updateGitIgnore } from '../../utils/update-gitignore';
import { addBuildTarget, addServeTarget } from './lib/add-targets';
import { Linter } from '@nx/eslint';
import { addE2e } from './lib/add-e2e';
import { nxVersion } from '../../utils/versions';
import { addLinting } from '../../utils/add-linting';

export async function applicationGenerator(tree: Tree, schema: Schema) {
  const tasks: GeneratorCallback[] = [];

  const options = await normalizeOptions(tree, schema);

  const nuxtInitTask = await nuxtInitGenerator(tree, {
    ...options,
    skipFormat: true,
  });
  tasks.push(nuxtInitTask);

  addProjectConfiguration(tree, options.name, {
    root: options.appProjectRoot,
    projectType: 'application',
    sourceRoot: `${options.appProjectRoot}/src`,
    targets: {},
  });

  generateFiles(tree, path.join(__dirname, './files'), options.appProjectRoot, {
    ...options,
    offsetFromRoot: offsetFromRoot(options.appProjectRoot),
    title: options.projectName,
    dot: '.',
    tmpl: '',
  });

  createTsConfig(
    tree,
    {
      projectRoot: options.appProjectRoot,
      rootProject: options.rootProject,
      unitTestRunner: options.unitTestRunner,
    },
    getRelativePathToRootTsConfig(tree, options.appProjectRoot)
  );

  addServeTarget(tree, options.name, options.appProjectRoot);
  addBuildTarget(tree, options.name, options.appProjectRoot);

  updateGitIgnore(tree);

  tasks.push(
    await addLinting(tree, {
      projectName: options.projectName,
      projectRoot: options.appProjectRoot,
      linter: options.linter ?? Linter.EsLint,
      unitTestRunner: options.unitTestRunner,
      rootProject: options.rootProject,
    })
  );

  if (options.unitTestRunner === 'vitest') {
    const { vitestGenerator } = ensurePackage('@nx/vite', nxVersion);
    tasks.push(
      await vitestGenerator(tree, {
        uiFramework: 'none',
        project: options.projectName,
        coverageProvider: 'c8',
        skipFormat: true,
      })
    );
  }

  tasks.push(await addE2e(tree, options));

  if (options.js) toJS(tree);

  if (!options.skipFormat) await formatFiles(tree);

  return runTasksInSerial(...tasks);
}

export default applicationGenerator;
