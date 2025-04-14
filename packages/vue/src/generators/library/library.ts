import {
  addProjectConfiguration,
  formatFiles,
  GeneratorCallback,
  installPackagesTask,
  joinPathFragments,
  readJson,
  readProjectConfiguration,
  runTasksInSerial,
  toJS,
  Tree,
  updateProjectConfiguration,
  writeJson,
} from '@nx/devkit';
import { getRelativeCwd } from '@nx/devkit/src/generators/artifact-name-and-directory-utils';
import { logShowProjectCommand } from '@nx/devkit/src/utils/log-show-project-command';
import { addTsConfigPath, initGenerator as jsInitGenerator } from '@nx/js';
import {
  addReleaseConfigForNonTsSolution,
  addReleaseConfigForTsSolution,
  releaseTasks,
} from '@nx/js/src/generators/library/utils/add-release-config';
import { sortPackageJsonFields } from '@nx/js/src/utils/package-json/sort-fields';
import {
  addProjectToTsSolutionWorkspace,
  updateTsconfigFiles,
} from '@nx/js/src/utils/typescript/ts-solution-setup';
import { shouldUseLegacyVersioning } from 'nx/src/command-line/release/config/use-legacy-versioning';
import type { PackageJson } from 'nx/src/utils/package-json';
import { relative } from 'path';
import { addLinting } from '../../utils/add-linting';
import { extractTsConfigBase } from '../../utils/create-ts-config';
import { ensureDependencies } from '../../utils/ensure-dependencies';
import componentGenerator from '../component/component';
import { vueInitGenerator } from '../init/init';
import { addVite } from './lib/add-vite';
import { createLibraryFiles } from './lib/create-library-files';
import { determineEntryFields } from './lib/determine-entry-fields';
import { normalizeOptions } from './lib/normalize-options';
import { Schema } from './schema';

export function libraryGenerator(tree: Tree, schema: Schema) {
  return libraryGeneratorInternal(tree, {
    addPlugin: false,
    useProjectJson: true,
    ...schema,
  });
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
    await addProjectToTsSolutionWorkspace(tree, options.projectRoot);
  }

  let packageJson: PackageJson = {
    name: options.importPath,
    version: '0.0.1',
  };

  if (!options.useProjectJson) {
    packageJson = {
      ...packageJson,
      ...determineEntryFields(options),
      files: options.publishable ? ['dist', '!**/*.tsbuildinfo'] : undefined,
    };
    if (options.parsedTags?.length) {
      packageJson.nx ??= {};
      packageJson.nx.tags = options.parsedTags;
    }
  } else {
    addProjectConfiguration(tree, options.projectName, {
      root: options.projectRoot,
      sourceRoot: joinPathFragments(options.projectRoot, 'src'),
      projectType: 'library',
      tags: options.parsedTags,
      targets: {},
    });
  }

  if (!options.useProjectJson || options.isUsingTsSolutionConfig) {
    writeJson(
      tree,
      joinPathFragments(options.projectRoot, 'package.json'),
      packageJson
    );
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
      const nxJson = readJson(tree, 'nx.json');
      await addReleaseConfigForNonTsSolution(
        shouldUseLegacyVersioning(nxJson.release),
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
