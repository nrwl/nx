import {
  addProjectConfiguration,
  formatFiles,
  GeneratorCallback,
  joinPathFragments,
  readNxJson,
  runTasksInSerial,
  toJS,
  Tree,
  writeJson,
} from '@nx/devkit';
import { Linter } from '@nx/eslint';
import { initGenerator as jsInitGenerator } from '@nx/js';
import { Schema } from './schema';
import { normalizeOptions } from './lib/normalize-options';
import { vueInitGenerator } from '../init/init';
import { addLinting } from '../../utils/add-linting';
import { addE2e } from './lib/add-e2e';
import { createApplicationFiles } from './lib/create-application-files';
import { addVite, addVitest } from './lib/add-vite';
import { addRsbuild } from './lib/add-rsbuild';
import { extractTsConfigBase } from '../../utils/create-ts-config';
import { ensureDependencies } from '../../utils/ensure-dependencies';
import { logShowProjectCommand } from '@nx/devkit/src/utils/log-show-project-command';
import { getImportPath } from '@nx/js/src/utils/get-import-path';
import { updateTsconfigFiles } from '@nx/js/src/utils/typescript/ts-solution-setup';

export function applicationGenerator(tree: Tree, options: Schema) {
  return applicationGeneratorInternal(tree, { addPlugin: false, ...options });
}

export async function applicationGeneratorInternal(
  tree: Tree,
  _options: Schema
): Promise<GeneratorCallback> {
  const tasks: GeneratorCallback[] = [];
  tasks.push(
    await jsInitGenerator(tree, {
      ..._options,
      tsConfigName: _options.rootProject
        ? 'tsconfig.json'
        : 'tsconfig.base.json',
      skipFormat: true,
      addTsPlugin: _options.useTsSolution,
      formatter: _options.formatter,
    })
  );

  const options = await normalizeOptions(tree, _options);
  const nxJson = readNxJson(tree);

  options.addPlugin ??=
    process.env.NX_ADD_PLUGINS !== 'false' &&
    nxJson.useInferencePlugins !== false;

  if (options.isUsingTsSolutionConfig) {
    writeJson(tree, joinPathFragments(options.appProjectRoot, 'package.json'), {
      name: getImportPath(tree, options.name),
      version: '0.0.1',
      private: true,
      nx: {
        name: options.name,
        projectType: 'application',
        sourceRoot: `${options.appProjectRoot}/src`,
        tags: options.parsedTags?.length ? options.parsedTags : undefined,
      },
    });
  } else {
    addProjectConfiguration(tree, options.projectName, {
      root: options.appProjectRoot,
      projectType: 'application',
      sourceRoot: `${options.appProjectRoot}/src`,
      tags: options.parsedTags?.length ? options.parsedTags : undefined,
      targets: {},
    });
  }

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

  await createApplicationFiles(tree, options);

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

  if (options.bundler === 'rsbuild') {
    tasks.push(...(await addRsbuild(tree, options)));
    tasks.push(...(await addVitest(tree, options)));
    tree.rename(
      joinPathFragments(options.appProjectRoot, 'vite.config.ts'),
      joinPathFragments(options.appProjectRoot, 'vitest.config.ts')
    );
  } else {
    tasks.push(await addVite(tree, options));
  }

  tasks.push(await addE2e(tree, options));

  if (options.js) toJS(tree);

  if (!options.skipFormat) await formatFiles(tree);

  if (options.isUsingTsSolutionConfig) {
    updateTsconfigFiles(
      tree,
      options.appProjectRoot,
      'tsconfig.app.json',
      {
        jsx: 'preserve',
        jsxImportSource: 'vue',
        module: 'esnext',
        moduleResolution: 'bundler',
        resolveJsonModule: true,
      },
      options.linter === 'eslint'
        ? ['eslint.config.js', 'eslint.config.cjs', 'eslint.config.mjs']
        : undefined
    );
  }

  tasks.push(() => {
    logShowProjectCommand(options.projectName);
  });

  return runTasksInSerial(...tasks);
}

export default applicationGenerator;
