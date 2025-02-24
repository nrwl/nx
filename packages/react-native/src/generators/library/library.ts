import {
  addProjectConfiguration,
  ensurePackage,
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
import { nxVersion } from '../../utils/versions';
import { NormalizedSchema, normalizeOptions } from './lib/normalize-options';
import { Schema } from './schema';
import { ensureDependencies } from '../../utils/ensure-dependencies';
import { logShowProjectCommand } from '@nx/devkit/src/utils/log-show-project-command';
import {
  addProjectToTsSolutionWorkspace,
  updateTsconfigFiles,
} from '@nx/js/src/utils/typescript/ts-solution-setup';
import { sortPackageJsonFields } from '@nx/js/src/utils/package-json/sort-fields';
import {
  addReleaseConfigForNonTsSolution,
  addReleaseConfigForTsSolution,
  releaseTasks,
} from '@nx/js/src/generators/library/utils/add-release-config';
import { PackageJson } from 'nx/src/utils/package-json';

export async function reactNativeLibraryGenerator(
  host: Tree,
  schema: Schema
): Promise<GeneratorCallback> {
  return await reactNativeLibraryGeneratorInternal(host, {
    addPlugin: false,
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

  if (options.publishable || options.buildable) {
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

  if (options.isUsingTsSolutionConfig) {
    addProjectToTsSolutionWorkspace(host, options.projectRoot);
  }

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

  const packageJsonPath = joinPathFragments(
    options.projectRoot,
    'package.json'
  );
  if (options.isUsingTsSolutionConfig) {
    writeJson(host, joinPathFragments(options.projectRoot, 'package.json'), {
      name: options.name,
      version: '0.0.1',
      ...determineEntryFields(options),
      nx: {
        tags: options.parsedTags?.length ? options.parsedTags : undefined,
      },
      files: options.publishable ? ['dist', '!**/*.tsbuildinfo'] : undefined,
    });
    if (options.publishable) {
      await addReleaseConfigForTsSolution(host, options.name, project);
    }
  } else {
    if (options.publishable) {
      await addReleaseConfigForNonTsSolution(host, options.name, project);
    }
    addProjectConfiguration(host, options.name, project);
  }

  if (!options.publishable && !options.buildable) {
    return () => {};
  }

  const { configurationGenerator } = ensurePackage<typeof import('@nx/rollup')>(
    '@nx/rollup',
    nxVersion
  );
  const rollupConfigTask = await configurationGenerator(host, {
    ...options,
    project: options.name,
    skipFormat: true,
  });

  updateJson(host, packageJsonPath, (json) => {
    if (json.type === 'module') {
      // The @nx/rollup:configuration generator can set the type to 'module' which would
      // potentially break this library.
      delete json.type;
    }
    return json;
  });

  const external = ['react/jsx-runtime', 'react-native', 'react', 'react-dom'];

  project.targets.build = {
    executor: '@nx/rollup:rollup',
    outputs: ['{options.outputPath}'],
    options: {
      outputPath: options.isUsingTsSolutionConfig
        ? `${options.projectRoot}/dist`
        : `dist/${options.projectRoot}`,
      tsConfig: `${options.projectRoot}/tsconfig.lib.json`,
      project: `${options.projectRoot}/package.json`,
      entryFile: maybeJs(options, `${options.projectRoot}/src/index.ts`),
      external,
      rollupConfig: `@nx/react/plugins/bundle-rollup`,
      assets: [
        {
          glob: `${options.projectRoot}/README.md`,
          input: '.',
          output: '.',
        },
      ],
    },
  };

  updateProjectConfiguration(host, options.name, project);

  return rollupConfigTask;
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

function maybeJs(options: NormalizedSchema, path: string): string {
  return options.js && (path.endsWith('.ts') || path.endsWith('.tsx'))
    ? path.replace(/\.tsx?$/, '.js')
    : path;
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
