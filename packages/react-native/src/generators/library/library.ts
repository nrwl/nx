import {
  addProjectConfiguration,
  formatFiles,
  generateFiles,
  GeneratorCallback,
  installPackagesTask,
  joinPathFragments,
  names,
  offsetFromRoot,
  ProjectConfiguration,
  runTasksInSerial,
  toJS,
  Tree,
  updateJson,
  updateProjectConfiguration,
  writeJson,
} from '@nx/devkit';

import {
  addTsConfigPath,
  getRelativePathToRootTsConfig,
  initGenerator as jsInitGenerator,
} from '@nx/js';
import init from '../init/init';
import { addLinting } from '../../utils/add-linting';
import { addJest } from '../../utils/add-jest';
import componentGenerator from '../component/component';
import { NormalizedSchema, normalizeOptions } from './lib/normalize-options';
import { Schema } from './schema';
import { ensureDependencies } from '../../utils/ensure-dependencies';
import { logShowProjectCommand } from '@nx/devkit/src/utils/log-show-project-command';
import {
  addProjectToTsSolutionWorkspace,
  updateTsconfigFiles,
} from '@nx/js/src/utils/typescript/ts-solution-setup';
import { sortPackageJsonFields } from '@nx/js/src/utils/package-json/sort-fields';
import { PackageJson } from 'nx/src/utils/package-json';
import { addRollupBuildTarget } from '@nx/react/src/generators/library/lib/add-rollup-build-target';
import { getRelativeCwd } from '@nx/devkit/src/generators/artifact-name-and-directory-utils';
import { relative } from 'path';
import { reactNativeVersion, reactVersion } from '../../utils/versions';
import {
  addReleaseConfigForNonTsSolution,
  addReleaseConfigForTsSolution,
  releaseTasks,
} from '@nx/js/src/generators/library/utils/add-release-config';

export async function reactNativeLibraryGenerator(
  host: Tree,
  schema: Schema
): Promise<GeneratorCallback> {
  return await reactNativeLibraryGeneratorInternal(host, {
    addPlugin: false,
    useProjectJson: true,
    ...schema,
  });
}

export async function reactNativeLibraryGeneratorInternal(
  host: Tree,
  schema: Schema
): Promise<GeneratorCallback> {
  const tasks: GeneratorCallback[] = [];

  const jsInitTask = await jsInitGenerator(host, {
    ...schema,
    skipFormat: true,
  });
  tasks.push(jsInitTask);

  const options = await normalizeOptions(host, schema);
  if (options.publishable === true && !schema.importPath) {
    throw new Error(
      `For publishable libs you have to provide a proper "--importPath" which needs to be a valid npm package name (e.g. my-awesome-lib or @myorg/my-lib)`
    );
  }

  const initTask = await init(host, { ...options, skipFormat: true });
  tasks.push(initTask);

  if (!options.skipPackageJson) {
    tasks.push(ensureDependencies(host));
  }

  createFiles(host, options);

  const addProjectTask = await addProject(host, options);
  if (addProjectTask) {
    tasks.push(addProjectTask);
  }

  if (options.isUsingTsSolutionConfig) {
    await addProjectToTsSolutionWorkspace(host, options.projectRoot);
  }

  const lintTask = await addLinting(host, {
    ...options,
    projectName: options.name,
    tsConfigPaths: [
      joinPathFragments(options.projectRoot, 'tsconfig.lib.json'),
    ],
  });
  tasks.push(lintTask);

  const jestTask = await addJest(
    host,
    options.unitTestRunner,
    options.name,
    options.projectRoot,
    options.js,
    options.skipPackageJson,
    options.addPlugin,
    'tsconfig.lib.json'
  );
  tasks.push(jestTask);

  const relativeCwd = getRelativeCwd();
  const path = joinPathFragments(
    options.projectRoot,
    'src/lib',
    options.fileName
  );
  const componentTask = await componentGenerator(host, {
    path: relativeCwd ? relative(relativeCwd, path) : path,
    skipTests: options.unitTestRunner === 'none',
    export: true,
    skipFormat: true,
    js: options.js,
  });
  tasks.push(() => componentTask);

  if (options.publishable) {
    tasks.push(await releaseTasks(host));
  }

  if (!options.skipTsConfig && !options.isUsingTsSolutionConfig) {
    addTsConfigPath(host, options.importPath, [
      joinPathFragments(
        options.projectRoot,
        './src',
        'index.' + (options.js ? 'js' : 'ts')
      ),
    ]);
  }
  updateTsconfigFiles(
    host,
    options.projectRoot,
    'tsconfig.lib.json',
    {
      jsx: 'react-jsx',
      module: 'esnext',
      moduleResolution: 'bundler',
    },
    options.linter === 'eslint'
      ? ['eslint.config.js', 'eslint.config.cjs', 'eslint.config.mjs']
      : undefined
  );

  sortPackageJsonFields(host, options.projectRoot);

  if (!options.skipFormat) {
    await formatFiles(host);
  }

  // Always run install to link packages.
  if (options.isUsingTsSolutionConfig) {
    tasks.push(() => installPackagesTask(host, true));
  }

  tasks.push(() => {
    logShowProjectCommand(options.name);
  });

  return runTasksInSerial(...tasks);
}

async function addProject(
  host: Tree,
  options: NormalizedSchema
): Promise<GeneratorCallback> {
  const project: ProjectConfiguration = {
    root: options.projectRoot,
    sourceRoot: joinPathFragments(options.projectRoot, 'src'),
    projectType: 'library',
    tags: options.parsedTags,
    targets: {},
  };

  let packageJson: PackageJson = {
    name: options.importPath,
    version: '0.0.1',
  };

  if (!options.useProjectJson) {
    packageJson = {
      ...packageJson,
      ...(options.buildable || options.publishable
        ? {}
        : determineEntryFields(options)),
      files: options.publishable ? ['dist', '!**/*.tsbuildinfo'] : undefined,
      peerDependencies: {
        react: reactVersion,
        'react-native': reactNativeVersion,
      },
    };
    if (options.name !== options.importPath) {
      packageJson.nx = { name: options.name };
    }
    if (options.parsedTags?.length) {
      packageJson.nx ??= {};
      packageJson.nx.tags = options.parsedTags;
    }
  } else {
    if (options.publishable) {
      await addReleaseConfigForNonTsSolution(host, options.name, project);
    }
    addProjectConfiguration(host, options.name, project);
  }

  if (
    !options.useProjectJson ||
    options.isUsingTsSolutionConfig ||
    options.publishable ||
    options.buildable
  ) {
    writeJson(
      host,
      joinPathFragments(options.projectRoot, 'package.json'),
      packageJson
    );
    if (options.publishable) {
      await addReleaseConfigForTsSolution(host, options.name, project);
      updateProjectConfiguration(host, options.name, project);
    }
  }

  if (options.publishable || options.buildable) {
    const external = new Set([
      'react/jsx-runtime',
      'react-native',
      'react',
      'react-dom',
    ]);
    const rollupTask = await addRollupBuildTarget(
      host,
      {
        ...options,
        format: ['cjs', 'esm'],
        style: 'none',
        js: options.js,
        skipFormat: true,
      },
      external
    );
    updateJson(host, `${options.projectRoot}/package.json`, (json) => {
      json.peerDependencies = {
        ...json.peerDependencies,
        react: reactVersion,
        'react-native': reactNativeVersion,
      };
      return json;
    });
    return rollupTask;
  }
  return () => {};
}

function updateTsConfig(tree: Tree, options: NormalizedSchema) {
  if (options.isUsingTsSolutionConfig) {
    return;
  }

  updateJson(
    tree,
    joinPathFragments(options.projectRoot, 'tsconfig.json'),
    (json) => {
      if (options.strict) {
        json.compilerOptions = {
          ...json.compilerOptions,
          forceConsistentCasingInFileNames: true,
          strict: true,
          noImplicitReturns: true,
          noFallthroughCasesInSwitch: true,
        };
      }

      return json;
    }
  );
}

function createFiles(host: Tree, options: NormalizedSchema) {
  generateFiles(
    host,
    joinPathFragments(__dirname, './files/lib'),
    options.projectRoot,
    {
      ...options,
      ...names(options.name),
      offsetFromRoot: offsetFromRoot(options.projectRoot),
      rootTsConfigPath: getRelativePathToRootTsConfig(
        host,
        options.projectRoot
      ),
    }
  );

  if (options.js) {
    toJS(host);
  }

  updateTsConfig(host, options);
}

function determineEntryFields(
  options: NormalizedSchema
): Pick<PackageJson, 'main' | 'types' | 'exports'> {
  return {
    main: options.js ? './src/index.js' : './src/index.ts',
    types: options.js ? './src/index.js' : './src/index.ts',
    exports: {
      '.': options.js
        ? './src/index.js'
        : {
            types: './src/index.ts',
            import: './src/index.ts',
            default: './src/index.ts',
          },
      './package.json': './package.json',
    },
  };
}

export default reactNativeLibraryGenerator;
