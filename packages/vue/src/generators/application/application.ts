import {
  addProjectConfiguration,
  formatFiles,
  GeneratorCallback,
  runTasksInSerial,
  toJS,
  Tree,
} from '@nx/devkit';
import { Linter } from '@nx/eslint';
import { Schema } from './schema';
import { normalizeOptions } from './lib/normalize-options';
import { vueInitGenerator } from '../init/init';
import { addLinting } from '../../utils/add-linting';
import { addE2e } from './lib/add-e2e';
import { createApplicationFiles } from './lib/create-application-files';
import { addVite } from './lib/add-vite';
import { extractTsConfigBase } from '../../utils/create-ts-config';

export async function applicationGenerator(
  tree: Tree,
  _options: Schema
): Promise<GeneratorCallback> {
  const options = await normalizeOptions(tree, _options);
  const tasks: GeneratorCallback[] = [];

  addProjectConfiguration(tree, options.name, {
    root: options.appProjectRoot,
    projectType: 'application',
    sourceRoot: `${options.appProjectRoot}/src`,
    targets: {},
  });

  tasks.push(
    await vueInitGenerator(tree, {
      ...options,
      skipFormat: true,
    })
  );

  if (!options.rootProject) {
    extractTsConfigBase(tree);
  }

  createApplicationFiles(tree, options);

  tasks.push(
    await addLinting(
      tree,
      {
        name: options.projectName,
        projectRoot: options.appProjectRoot,
        linter: options.linter ?? Linter.EsLint,
        unitTestRunner: options.unitTestRunner,
        skipPackageJson: options.skipPackageJson,
        setParserOptionsProject: options.setParserOptionsProject,
        rootProject: options.rootProject,
      },
      'app'
    )
  );

  tasks.push(await addVite(tree, options));

  tasks.push(await addE2e(tree, options));

  if (options.js) toJS(tree);

  if (!options.skipFormat) await formatFiles(tree);

  return runTasksInSerial(...tasks);
}

export default applicationGenerator;
