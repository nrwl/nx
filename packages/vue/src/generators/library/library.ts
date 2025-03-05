import {
  addProjectConfiguration,
  formatFiles,
  GeneratorCallback,
  installPackagesTask,
  joinPathFragments,
  readProjectConfiguration,
  runTasksInSerial,
  toJS,
  Tree,
  updateProjectConfiguration,
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
import {
  addProjectToTsSolutionWorkspace,
  updateTsconfigFiles,
} from '@nx/js/src/utils/typescript/ts-solution-setup';
import { determineEntryFields } from './lib/determine-entry-fields';
import { sortPackageJsonFields } from '@nx/js/src/utils/package-json/sort-fields';
import {
  addReleaseConfigForNonTsSolution,
  addReleaseConfigForTsSolution,
  releaseTasks,
} from '@nx/js/src/generators/library/utils/add-release-config';
import type { PackageJson } from 'nx/src/utils/package-json';

export function libraryGenerator(tree: Tree, schema: Schema) {
  return libraryGeneratorInternal(tree, { addPlugin: false, ...schema });
}

export async function libraryGeneratorInternal(tree: Tree, schema: Schema) {
  const tasks: GeneratorCallback[] = [];

  const options = await normalizeOptions(tree, schema);
  if (options.publishable === true && !schema.importPath) {
    throw new Error(
      `For publishable libs you have to provide a proper "--importPath" which needs to be a valid npm package name (e.g. my-awesome-lib or @myorg/my-lib)`
    );
  }

  tasks.push(await jsInitGenerator(tree, { ...options, skipFormat: true }));

  // If we are using the new TS solution
  // We need to update the workspace file (package.json or pnpm-workspaces.yaml) to include the new project
  if (options.isUsingTsSolutionConfig) {
    addProjectToTsSolutionWorkspace(tree, options.projectRoot);
  }

  if (options.isUsingTsSolutionConfig) {
    const packageJson: PackageJson = {
      name: options.importPath,
      version: '0.0.1',
      ...determineEntryFields(options),
      files: options.publishable ? ['dist', '!**/*.tsbuildinfo'] : undefined,
    };

    if (options.projectName !== options.importPath) {
      packageJson.nx = { name: options.projectName };
    }
    if (options.parsedTags?.length) {
      packageJson.nx ??= {};
      packageJson.nx.tags = options.parsedTags;
    }

    writeJson(
      tree,
      joinPathFragments(options.projectRoot, 'package.json'),
      packageJson
    );
  } else {
    addProjectConfiguration(tree, options.projectName, {
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

  sortPackageJsonFields(tree, options.projectRoot);

  if (options.publishable) {
    const projectConfig = readProjectConfiguration(tree, options.projectName);
    if (options.isUsingTsSolutionConfig) {
      await addReleaseConfigForTsSolution(
        tree,
        options.projectName,
        projectConfig
      );
    } else {
      await addReleaseConfigForNonTsSolution(
        tree,
        options.projectName,
        projectConfig
      );
    }
    updateProjectConfiguration(tree, options.projectName, projectConfig);
    tasks.push(await releaseTasks(tree));
  }

  if (!options.skipFormat) await formatFiles(tree);

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
