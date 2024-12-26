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
import {
  nxVersion,
  reactNativeVersion,
  reactVersion,
} from '../../utils/versions';
import { NormalizedSchema, normalizeOptions } from './lib/normalize-options';
import { Schema } from './schema';
import { ensureDependencies } from '../../utils/ensure-dependencies';
import { initRootBabelConfig } from '../../utils/init-root-babel-config';
import { addBuildTargetDefaults } from '@nx/devkit/src/generators/target-defaults-utils';
import { logShowProjectCommand } from '@nx/devkit/src/utils/log-show-project-command';
import {
  addProjectToTsSolutionWorkspace,
  updateTsconfigFiles,
} from '@nx/js/src/utils/typescript/ts-solution-setup';
import { getImportPath } from '@nx/js/src/utils/get-import-path';

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
    options.addPlugin
  );
  tasks.push(jestTask);

  if (options.publishable || options.buildable) {
    updateLibPackageNpmScope(host, options);
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
    const packageName = getImportPath(host, options.name);
    const sourceEntry = !options.buildable
      ? options.js
        ? './src/index.js'
        : './src/index.ts'
      : undefined;
    writeJson(host, joinPathFragments(options.projectRoot, 'package.json'), {
      name: packageName,
      version: '0.0.1',
      main: sourceEntry,
      types: sourceEntry,
      nx: {
        name: packageName === options.name ? undefined : options.name,
        projectType: 'library',
        sourceRoot: joinPathFragments(options.projectRoot, 'src'),
        tags: options.parsedTags?.length ? options.parsedTags : undefined,
      },
    });
  } else {
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

  const external = ['react/jsx-runtime', 'react-native', 'react', 'react-dom'];

  addBuildTargetDefaults(host, '@nx/rollup:rollup');

  project.targets.build = {
    executor: '@nx/rollup:rollup',
    outputs: ['{options.outputPath}'],
    options: {
      outputPath: `dist/${options.projectRoot}`,
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

  if (!options.publishable && !options.buildable) {
    host.delete(`${options.projectRoot}/package.json`);
  }

  if (options.js) {
    toJS(host);
  }

  updateTsConfig(host, options);
}

function updateLibPackageNpmScope(host: Tree, options: NormalizedSchema) {
  return updateJson(host, `${options.projectRoot}/package.json`, (json) => {
    json.name = options.importPath;
    json.peerDependencies = {
      react: reactVersion,
      'react-native': reactNativeVersion,
    };
    return json;
  });
}

function maybeJs(options: NormalizedSchema, path: string): string {
  return options.js && (path.endsWith('.ts') || path.endsWith('.tsx'))
    ? path.replace(/\.tsx?$/, '.js')
    : path;
}

export default expoLibraryGenerator;
