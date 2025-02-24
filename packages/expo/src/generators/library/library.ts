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
import { NormalizedSchema, normalizeOptions } from './lib/normalize-options';
import { Schema } from './schema';
import { ensureDependencies } from '../../utils/ensure-dependencies';
import { initRootBabelConfig } from '../../utils/init-root-babel-config';
import { logShowProjectCommand } from '@nx/devkit/src/utils/log-show-project-command';
import {
  addProjectToTsSolutionWorkspace,
  updateTsconfigFiles,
} from '@nx/js/src/utils/typescript/ts-solution-setup';
import { sortPackageJsonFields } from '@nx/js/src/utils/package-json/sort-fields';
import { PackageJson } from 'nx/src/utils/package-json';
import { addRollupBuildTarget } from '@nx/react/src/generators/library/lib/add-rollup-build-target';
import { getRelativeCwd } from '@nx/devkit/src/generators/artifact-name-and-directory-utils';
import { expoComponentGenerator } from '../component/component';
import { relative } from 'path';

export async function expoLibraryGenerator(
  host: Tree,
  schema: Schema
): Promise<GeneratorCallback> {
  return await expoLibraryGeneratorInternal(host, {
    addPlugin: false,
    ...schema,
  });
}

export async function expoLibraryGeneratorInternal(
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

  if (options.isUsingTsSolutionConfig) {
    addProjectToTsSolutionWorkspace(host, options.projectRoot);
  }

  const initTask = await init(host, { ...options, skipFormat: true });
  tasks.push(initTask);
  if (!options.skipPackageJson) {
    tasks.push(ensureDependencies(host));
  }
  initRootBabelConfig(host);

  createFiles(host, options);

  const addProjectTask = await addProject(host, options);
  if (addProjectTask) {
    tasks.push(addProjectTask);
  }

  const lintTask = await addLinting(host, {
    ...options,
    projectName: options.projectName,
    tsConfigPaths: [
      joinPathFragments(options.projectRoot, 'tsconfig.lib.json'),
    ],
  });
  tasks.push(lintTask);

  const jestTask = await addJest(
    host,
    options.unitTestRunner,
    options.projectName,
    options.projectRoot,
    options.js,
    options.skipPackageJson,
    options.addPlugin
  );
  tasks.push(jestTask);

  const relativeCwd = getRelativeCwd();
  const path = joinPathFragments(
    options.projectRoot,
    'src/lib',
    options.fileName
  );
  const componentTask = await expoComponentGenerator(host, {
    path: relativeCwd ? relative(relativeCwd, path) : path,
    skipTests: options.unitTestRunner === 'none',
    export: true,
    skipFormat: true,
    js: options.js,
  });
  tasks.push(() => componentTask);

  if (!options.skipTsConfig && !options.isUsingTsSolutionConfig) {
    addTsConfigPath(host, options.importPath, [
      joinPathFragments(
        options.projectRoot,
        options.js ? './src/index.js' : './src/index.ts'
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

  if (options.isUsingTsSolutionConfig) {
    writeJson(host, joinPathFragments(options.projectRoot, 'package.json'), {
      name: options.projectName,
      version: '0.0.1',
      ...determineEntryFields(options),
      nx: {
        tags: options.parsedTags?.length ? options.parsedTags : undefined,
      },
      files: options.publishable ? ['dist', '!**/*.tsbuildinfo'] : undefined,
    });
  } else {
    addProjectConfiguration(host, options.name, project);
  }

  if (options.publishable || options.buildable) {
    const external = new Set([
      'react/jsx-runtime',
      'react-native',
      'react',
      'react-dom',
    ]);
    return await addRollupBuildTarget(
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
  }
  return () => {};
}

function updateTsConfig(tree: Tree, options: NormalizedSchema) {
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
      tmpl: '',
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

export default expoLibraryGenerator;
