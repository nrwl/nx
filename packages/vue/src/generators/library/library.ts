import {
  addProjectConfiguration,
  formatFiles,
  GeneratorCallback,
  installPackagesTask,
  joinPathFragments,
  readNxJson,
  runTasksInSerial,
  toJS,
  Tree,
  updateJson,
  updateNxJson,
  writeJson,
} from '@nx/devkit';
import { addTsConfigPath, initGenerator as jsInitGenerator } from '@nx/js';
import { vueInitGenerator } from '../init/init';
import { Schema } from './schema';
import { normalizeOptions } from './lib/normalize-options';
import { addLinting } from '../../utils/add-linting';
import { createLibraryFiles } from './lib/create-library-files';
import { extractTsConfigBase } from '../../utils/create-ts-config';
import componentGenerator from '../component/component';
import { addVite } from './lib/add-vite';
import { ensureDependencies } from '../../utils/ensure-dependencies';
import { logShowProjectCommand } from '@nx/devkit/src/utils/log-show-project-command';
import { getRelativeCwd } from '@nx/devkit/src/generators/artifact-name-and-directory-utils';
import { relative } from 'path';
import { getImportPath } from '@nx/js/src/utils/get-import-path';
import { updateTsconfigFiles } from '@nx/js/src/utils/typescript/ts-solution-setup';
import { ensureProjectIsExcludedFromPluginRegistrations } from '@nx/js/src/utils/typescript/plugin';

export function libraryGenerator(tree: Tree, schema: Schema) {
  return libraryGeneratorInternal(tree, { addPlugin: false, ...schema });
}

export async function libraryGeneratorInternal(tree: Tree, schema: Schema) {
  const tasks: GeneratorCallback[] = [];

  tasks.push(await jsInitGenerator(tree, { ...schema, skipFormat: true }));

  const options = await normalizeOptions(tree, schema);
  if (options.publishable === true && !schema.importPath) {
    throw new Error(
      `For publishable libs you have to provide a proper "--importPath" which needs to be a valid npm package name (e.g. my-awesome-lib or @myorg/my-lib)`
    );
  }

  if (options.isUsingTsSolutionConfig) {
    const moduleFile =
      options.bundler === 'none'
        ? options.js
          ? './src/index.js'
          : './src/index.ts'
        : './dist/index.mjs';
    const typesFile =
      options.bundler === 'none'
        ? options.js
          ? './src/index.js'
          : './src/index.ts'
        : './dist/index.d.ts';
    writeJson(tree, joinPathFragments(options.projectRoot, 'package.json'), {
      name: getImportPath(tree, options.name),
      version: '0.0.1',
      private: true,
      module: moduleFile,
      types: typesFile,
      files: options.publishable ? ['dist', '!**/*.tsbuildinfo'] : undefined,
      nx: {
        name: options.name,
        projectType: 'application',
        sourceRoot: `${options.projectRoot}/src`,
        tags: options.parsedTags?.length ? options.parsedTags : undefined,
      },
    });
  } else {
    addProjectConfiguration(tree, options.name, {
      root: options.projectRoot,
      sourceRoot: joinPathFragments(options.projectRoot, 'src'),
      projectType: 'library',
      tags: options.parsedTags,
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

  extractTsConfigBase(tree);

  tasks.push(await addLinting(tree, options, 'lib'));

  createLibraryFiles(tree, options);

  tasks.push(await addVite(tree, options));

  if (options.component) {
    const relativeCwd = getRelativeCwd();
    const path = joinPathFragments(
      options.projectRoot,
      'src/lib',
      options.fileName
    );
    await componentGenerator(tree, {
      path: relativeCwd ? relative(relativeCwd, path) : path,
      skipTests:
        options.unitTestRunner === 'none' ||
        (options.unitTestRunner === 'vitest' && options.inSourceTests == true),
      export: true,
      routing: options.routing,
      js: options.js,
      inSourceTests: options.inSourceTests,
      skipFormat: true,
    });
  }

  if (
    !options.isUsingTsSolutionConfig &&
    (options.publishable || options.bundler !== 'none')
  ) {
    updateJson(tree, `${options.projectRoot}/package.json`, (json) => {
      json.name = options.importPath;
      return json;
    });
  }

  if (options.bundler === 'none' && options.addPlugin) {
    const nxJson = readNxJson(tree);
    ensureProjectIsExcludedFromPluginRegistrations(nxJson, options.projectRoot);
    updateNxJson(tree, nxJson);
  }

  if (!options.skipTsConfig && !options.isUsingTsSolutionConfig) {
    addTsConfigPath(tree, options.importPath, [
      joinPathFragments(
        options.projectRoot,
        './src',
        'index.' + (options.js ? 'js' : 'ts')
      ),
    ]);
  }

  if (options.js) toJS(tree);

  if (!options.skipFormat) await formatFiles(tree);

  if (options.isUsingTsSolutionConfig) {
    updateTsconfigFiles(
      tree,
      options.projectRoot,
      'tsconfig.lib.json',
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

  // Always run install to link packages.
  if (options.isUsingTsSolutionConfig) {
    tasks.push(() => installPackagesTask(tree, true));
  }

  tasks.push(() => {
    logShowProjectCommand(options.name);
  });

  return runTasksInSerial(...tasks);
}

export default libraryGenerator;
