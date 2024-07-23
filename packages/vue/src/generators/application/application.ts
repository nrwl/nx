import {
  addProjectConfiguration,
  formatFiles,
  GeneratorCallback,
  readNxJson,
  runTasksInSerial,
  toJS,
  Tree,
} from '@nx/devkit';
import { Linter } from '@nx/eslint';
import { initGenerator as jsInitGenerator } from '@nx/js';
import { Schema } from './schema';
import { normalizeOptions } from './lib/normalize-options';
import { vueInitGenerator } from '../init/init';
import { addLinting } from '../../utils/add-linting';
import { addE2e } from './lib/add-e2e';
import { createApplicationFiles } from './lib/create-application-files';
import { addVite } from './lib/add-vite';
import { extractTsConfigBase } from '../../utils/create-ts-config';
import { ensureDependencies } from '../../utils/ensure-dependencies';
import { logShowProjectCommand } from '@nx/devkit/src/utils/log-show-project-command';

export function applicationGenerator(tree: Tree, options: Schema) {
  return applicationGeneratorInternal(tree, { addPlugin: false, ...options });
}

export async function applicationGeneratorInternal(
  tree: Tree,
  _options: Schema
): Promise<GeneratorCallback> {
  const options = await normalizeOptions(tree, _options);
  const nxJson = readNxJson(tree);

  options.addPlugin ??=
    process.env.NX_ADD_PLUGINS !== 'false' &&
    nxJson.useInferencePlugins !== false;

  const tasks: GeneratorCallback[] = [];

  addProjectConfiguration(tree, options.projectName, {
    root: options.appProjectRoot,
    projectType: 'application',
    sourceRoot: `${options.appProjectRoot}/src`,
    targets: {},
  });

  tasks.push(
    await jsInitGenerator(tree, {
      ...options,
      tsConfigName: options.rootProject
        ? 'tsconfig.json'
        : 'tsconfig.base.json',
      skipFormat: true,
    })
  );
  tasks.push(
    await vueInitGenerator(tree, {
      ...options,
      skipFormat: true,
    })
  );
  if (!options.skipPackageJson) {
    tasks.push(ensureDependencies(tree, options));
  }

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
        addPlugin: options.addPlugin,
      },
      'app'
    )
  );

  tasks.push(await addVite(tree, options));

  tasks.push(await addE2e(tree, options));

  if (options.js) toJS(tree);

  if (!options.skipFormat) await formatFiles(tree);

  tasks.push(() => {
    logShowProjectCommand(options.projectName);
  });

  return runTasksInSerial(...tasks);
}

export default applicationGenerator;
