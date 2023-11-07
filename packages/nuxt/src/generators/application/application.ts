import {
  addProjectConfiguration,
  formatFiles,
  generateFiles,
  GeneratorCallback,
  joinPathFragments,
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
import { addLinting } from '../../utils/add-linting';
import { addVitest } from './lib/add-vitest';

export async function applicationGenerator(tree: Tree, schema: Schema) {
  const tasks: GeneratorCallback[] = [];

  const options = await normalizeOptions(tree, schema);

  const outputPath = joinPathFragments('dist', options.appProjectRoot);

  const projectOffsetFromRoot = offsetFromRoot(options.appProjectRoot);

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

  generateFiles(
    tree,
    joinPathFragments(__dirname, './files'),
    options.appProjectRoot,
    {
      ...options,
      offsetFromRoot: projectOffsetFromRoot,
      title: options.projectName,
      dot: '.',
      tmpl: '',
      style: options.style,
    }
  );

  if (options.style === 'none') {
    tree.delete(
      joinPathFragments(options.appProjectRoot, `src/assets/css/styles.none`)
    );
  }

  createTsConfig(
    tree,
    {
      projectRoot: options.appProjectRoot,
      rootProject: options.rootProject,
      unitTestRunner: options.unitTestRunner,
      outputPath,
    },
    getRelativePathToRootTsConfig(tree, options.appProjectRoot)
  );

  addServeTarget(tree, options.name);
  addBuildTarget(tree, options.name, outputPath);

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
    addVitest(tree, options, options.appProjectRoot, projectOffsetFromRoot);
  }

  tasks.push(await addE2e(tree, options));

  if (options.js) toJS(tree);

  if (!options.skipFormat) await formatFiles(tree);

  return runTasksInSerial(...tasks);
}

export default applicationGenerator;
