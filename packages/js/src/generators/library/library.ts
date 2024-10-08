import {
  addDependenciesToPackageJson,
  addProjectConfiguration,
  ensurePackage,
  formatFiles,
  generateFiles,
  GeneratorCallback,
  getPackageManagerCommand,
  joinPathFragments,
  names,
  offsetFromRoot,
  output,
  ProjectConfiguration,
  ProjectGraphProjectNode,
  readNxJson,
  readProjectConfiguration,
  runTasksInSerial,
  toJS,
  Tree,
  updateJson,
  updateNxJson,
  updateProjectConfiguration,
  writeJson,
} from '@nx/devkit';
import {
  determineProjectNameAndRootOptions,
  ensureProjectName,
} from '@nx/devkit/src/generators/project-name-and-root-utils';

import { addBuildTargetDefaults } from '@nx/devkit/src/generators/target-defaults-utils';
import { logShowProjectCommand } from '@nx/devkit/src/utils/log-show-project-command';
import { prompt } from 'enquirer';
import { findMatchingProjects } from 'nx/src/utils/find-matching-projects';
import { isCI } from 'nx/src/utils/is-ci';
import { type PackageJson } from 'nx/src/utils/package-json';
import { join } from 'path';
import type { CompilerOptions } from 'typescript';
import { getProjectPackageManagerWorkspaceState } from '../../utils/package-manager-workspaces';
import { addSwcConfig } from '../../utils/swc/add-swc-config';
import { getSwcDependencies } from '../../utils/swc/add-swc-dependencies';
import { getNeededCompilerOptionOverrides } from '../../utils/typescript/configuration';
import { tsConfigBaseOptions } from '../../utils/typescript/create-ts-config';
import {
  addTsConfigPath,
  getRelativePathToRootTsConfig,
  getRootTsConfigFileName,
} from '../../utils/typescript/ts-config';
import {
  isUsingTsSolutionSetup,
  isUsingTypeScriptPlugin,
} from '../../utils/typescript/ts-solution-setup';
import {
  esbuildVersion,
  nxVersion,
  swcHelpersVersion,
  tsLibVersion,
  typesNodeVersion,
} from '../../utils/versions';
import jsInitGenerator from '../init/init';
import setupVerdaccio from '../setup-verdaccio/generator';
import type {
  Bundler,
  LibraryGeneratorSchema,
  NormalizedLibraryGeneratorOptions,
} from './schema';
import { getProjectPackageManagerWorkspaceStateWarningTask } from './utils/package-manager-workspaces';
import {
  ensureProjectIsExcludedFromPluginRegistrations,
  ensureProjectIsIncludedInPluginRegistrations,
} from './utils/plugin-registrations';

const defaultOutputDirectory = 'dist';

export async function libraryGenerator(
  tree: Tree,
  schema: LibraryGeneratorSchema
) {
  return await libraryGeneratorInternal(tree, {
    addPlugin: false,
    useProjectJson: true,
    ...schema,
  });
}

export async function libraryGeneratorInternal(
  tree: Tree,
  schema: LibraryGeneratorSchema
) {
  const tasks: GeneratorCallback[] = [];

  tasks.push(
    await jsInitGenerator(tree, {
      ...schema,
      skipFormat: true,
      tsConfigName: schema.rootProject ? 'tsconfig.json' : 'tsconfig.base.json',
      addTsConfigBase: true,
      // In the new setup, Prettier is prompted for and installed during `create-nx-workspace`.
      formatter: isUsingTsSolutionSetup(tree) ? 'none' : 'prettier',
    })
  );
  const options = await normalizeOptions(tree, schema);

  createFiles(tree, options);

  await configureProject(tree, options);

  if (!options.skipPackageJson) {
    tasks.push(addProjectDependencies(tree, options));
  }

  if (options.publishable) {
    tasks.push(await setupVerdaccio(tree, { ...options, skipFormat: true }));
  }

  if (options.bundler === 'rollup') {
    const { configurationGenerator } = ensurePackage('@nx/rollup', nxVersion);
    await configurationGenerator(tree, {
      project: options.name,
      compiler: 'swc',
      format: ['cjs', 'esm'],
    });
  }

  if (options.bundler === 'vite') {
    const { viteConfigurationGenerator, createOrEditViteConfig } =
      ensurePackage('@nx/vite', nxVersion);
    const viteTask = await viteConfigurationGenerator(tree, {
      project: options.name,
      newProject: true,
      uiFramework: 'none',
      includeVitest: options.unitTestRunner === 'vitest',
      includeLib: true,
      skipFormat: true,
      testEnvironment: options.testEnvironment,
      addPlugin: options.addPlugin,
    });
    tasks.push(viteTask);
    createOrEditViteConfig(
      tree,
      {
        project: options.name,
        includeLib: true,
        includeVitest: options.unitTestRunner === 'vitest',
        testEnvironment: options.testEnvironment,
      },
      false
    );
  }
  if (options.linter !== 'none') {
    const lintCallback = await addLint(tree, options);
    tasks.push(lintCallback);
  }

  if (options.unitTestRunner === 'jest') {
    const jestCallback = await addJest(tree, options);
    tasks.push(jestCallback);
    if (options.bundler === 'swc' || options.bundler === 'rollup') {
      replaceJestConfig(tree, options);
    }
  } else if (
    options.unitTestRunner === 'vitest' &&
    options.bundler !== 'vite' // Test would have been set up already
  ) {
    const { vitestGenerator, createOrEditViteConfig } = ensurePackage(
      '@nx/vite',
      nxVersion
    );
    const vitestTask = await vitestGenerator(tree, {
      project: options.name,
      uiFramework: 'none',
      coverageProvider: 'v8',
      skipFormat: true,
      testEnvironment: options.testEnvironment,
      runtimeTsconfigFileName: 'tsconfig.lib.json',
      compiler: options.compiler === 'swc' ? 'swc' : 'babel',
    });
    tasks.push(vitestTask);
    createOrEditViteConfig(
      tree,
      {
        project: options.name,
        includeLib: false,
        includeVitest: true,
        testEnvironment: options.testEnvironment,
      },
      true
    );
  }

  if (!schema.skipTsConfig && !options.isUsingTsSolutionConfig) {
    addTsConfigPath(tree, options.importPath, [
      joinPathFragments(
        options.projectRoot,
        './src',
        'index.' + (options.js ? 'js' : 'ts')
      ),
    ]);
  }

  if (options.isUsingTsSolutionConfig && options.unitTestRunner !== 'none') {
    updateJson(
      tree,
      joinPathFragments(options.projectRoot, 'tsconfig.spec.json'),
      (json) => {
        const rootOffset = offsetFromRoot(options.projectRoot);
        // ensure it extends from the root tsconfig.base.json
        json.extends = joinPathFragments(rootOffset, 'tsconfig.base.json');
        // ensure outDir is set to the correct value
        json.compilerOptions ??= {};
        json.compilerOptions.outDir = joinPathFragments(
          rootOffset,
          'dist/out-tsc',
          options.projectRoot
        );
        // add project reference to the runtime tsconfig.lib.json file
        json.references ??= [];
        json.references.push({ path: './tsconfig.lib.json' });
        return json;
      }
    );
  }

  if (!options.skipFormat) {
    await formatFiles(tree);
  }

  if (
    options.isUsingTsSolutionConfig &&
    options.projectPackageManagerWorkspaceState !== 'included'
  ) {
    tasks.push(
      getProjectPackageManagerWorkspaceStateWarningTask(
        options.projectPackageManagerWorkspaceState,
        tree.root
      )
    );
  }

  if (options.publishable) {
    tasks.push(() => {
      logNxReleaseDocsInfo();
    });
  }

  tasks.push(() => {
    logShowProjectCommand(options.name);
  });

  return runTasksInSerial(...tasks);
}

async function configureProject(
  tree: Tree,
  options: NormalizedLibraryGeneratorOptions
) {
  if (options.hasPlugin) {
    const nxJson = readNxJson(tree);
    if (options.bundler === 'none') {
      ensureProjectIsExcludedFromPluginRegistrations(
        nxJson,
        options.projectRoot
      );
    } else {
      ensureProjectIsIncludedInPluginRegistrations(nxJson, options.projectRoot);
    }
    updateNxJson(tree, nxJson);
  }

  if (!options.useProjectJson) {
    // we create a cleaner project configuration for the package.json file
    const projectConfiguration: ProjectConfiguration = {
      root: options.projectRoot,
    };

    if (options.name !== options.importPath) {
      // if the name is different than the package.json name, we need to set
      // the proper name in the configuration
      projectConfiguration.name = options.name;
    }

    if (options.parsedTags?.length) {
      projectConfiguration.tags = options.parsedTags;
    }

    if (options.publishable) {
      await addProjectToNxReleaseConfig(tree, options, projectConfiguration);
    }

    updateProjectConfiguration(tree, options.name, projectConfiguration);

    return;
  }

  const projectConfiguration: ProjectConfiguration = {
    root: options.projectRoot,
    sourceRoot: joinPathFragments(options.projectRoot, 'src'),
    projectType: 'library',
    targets: {},
    tags: options.parsedTags,
  };

  if (
    options.bundler &&
    options.bundler !== 'none' &&
    options.config !== 'npm-scripts'
  ) {
    if (options.bundler !== 'rollup') {
      const outputPath = getOutputPath(options);
      const executor = getBuildExecutor(options.bundler);
      addBuildTargetDefaults(tree, executor);

      projectConfiguration.targets.build = {
        executor,
        outputs: ['{options.outputPath}'],
        options: {
          outputPath,
          main:
            `${options.projectRoot}/src/index` + (options.js ? '.js' : '.ts'),
          tsConfig: `${options.projectRoot}/tsconfig.lib.json`,
          assets: [],
        },
      };

      if (options.bundler === 'esbuild') {
        projectConfiguration.targets.build.options.generatePackageJson = true;
        projectConfiguration.targets.build.options.format = ['cjs'];
      }

      if (options.bundler === 'swc' && options.skipTypeCheck) {
        projectConfiguration.targets.build.options.skipTypeCheck = true;
      }

      if (!options.minimal) {
        projectConfiguration.targets.build.options.assets ??= [];
        projectConfiguration.targets.build.options.assets.push(
          joinPathFragments(options.projectRoot, '*.md')
        );
      }
    }

    if (options.publishable) {
      const packageRoot = joinPathFragments(
        defaultOutputDirectory,
        '{projectRoot}'
      );

      projectConfiguration.targets ??= {};
      projectConfiguration.targets['nx-release-publish'] = {
        options: {
          packageRoot,
        },
      };

      projectConfiguration.release = {
        version: {
          generatorOptions: {
            packageRoot,
            // using git tags to determine the current version is required here because
            // the version in the package root is overridden with every build
            currentVersionResolver: 'git-tag',
          },
        },
      };

      await addProjectToNxReleaseConfig(tree, options, projectConfiguration);
    }
  }

  if (options.config === 'workspace' || options.config === 'project') {
    addProjectConfiguration(tree, options.name, projectConfiguration);
  } else {
    addProjectConfiguration(tree, options.name, {
      root: projectConfiguration.root,
      tags: projectConfiguration.tags,
      targets: {},
    });
  }
}

export type AddLintOptions = Pick<
  NormalizedLibraryGeneratorOptions,
  | 'name'
  | 'linter'
  | 'projectRoot'
  | 'unitTestRunner'
  | 'js'
  | 'setParserOptionsProject'
  | 'rootProject'
  | 'bundler'
  | 'addPlugin'
>;

export async function addLint(
  tree: Tree,
  options: AddLintOptions
): Promise<GeneratorCallback> {
  const { lintProjectGenerator } = ensurePackage('@nx/eslint', nxVersion);
  const projectConfiguration = readProjectConfiguration(tree, options.name);
  const task = await lintProjectGenerator(tree, {
    project: options.name,
    linter: options.linter,
    skipFormat: true,
    tsConfigPaths: [
      joinPathFragments(options.projectRoot, 'tsconfig.lib.json'),
    ],
    unitTestRunner: options.unitTestRunner,
    setParserOptionsProject: options.setParserOptionsProject,
    rootProject: options.rootProject,
    addPlugin: options.addPlugin,
    // Since the build target is inferred now, we need to let the generator know to add @nx/dependency-checks regardless.
    addPackageJsonDependencyChecks: options.bundler !== 'none',
  });
  const {
    addOverrideToLintConfig,
    lintConfigHasOverride,
    isEslintConfigSupported,
    updateOverrideInLintConfig,
    // nx-ignore-next-line
  } = require('@nx/eslint/src/generators/utils/eslint-file');

  // if config is not supported, we don't need to do anything
  if (!isEslintConfigSupported(tree)) {
    return task;
  }

  // Also update the root ESLint config. The lintProjectGenerator will not generate it for root projects.
  // But we need to set the package.json checks.
  if (options.rootProject) {
    addOverrideToLintConfig(tree, '', {
      files: ['*.json'],
      parser: 'jsonc-eslint-parser',
      rules: {
        '@nx/dependency-checks': [
          'error',
          {
            // With flat configs, we don't want to include imports in the eslint js/cjs/mjs files to be checked
            ignoredFiles: ['{projectRoot}/eslint.config.{js,cjs,mjs}'],
          },
        ],
      },
    });
  }

  // If project lints package.json with @nx/dependency-checks, then add ignore files for
  // build configuration files such as vite.config.ts. These config files need to be
  // ignored, otherwise we will errors on missing dependencies that are for dev only.
  if (
    lintConfigHasOverride(
      tree,
      projectConfiguration.root,
      (o) =>
        Array.isArray(o.files)
          ? o.files.some((f) => f.match(/\.json$/))
          : !!o.files?.match(/\.json$/),
      true
    )
  ) {
    updateOverrideInLintConfig(
      tree,
      projectConfiguration.root,
      (o) => o.rules?.['@nx/dependency-checks'],
      (o) => {
        const value = o.rules['@nx/dependency-checks'];
        let ruleSeverity: string;
        let ruleOptions: any;
        if (Array.isArray(value)) {
          ruleSeverity = value[0];
          ruleOptions = value[1];
        } else {
          ruleSeverity = value;
          ruleOptions = {};
        }
        if (options.bundler === 'vite' || options.unitTestRunner === 'vitest') {
          ruleOptions.ignoredFiles ??= [];
          ruleOptions.ignoredFiles.push(
            '{projectRoot}/vite.config.{js,ts,mjs,mts}'
          );
          o.rules['@nx/dependency-checks'] = [ruleSeverity, ruleOptions];
        } else if (options.bundler === 'rollup') {
          ruleOptions.ignoredFiles ??= [];
          ruleOptions.ignoredFiles.push(
            '{projectRoot}/rollup.config.{js,ts,mjs,mts}'
          );
          o.rules['@nx/dependency-checks'] = [ruleSeverity, ruleOptions];
        } else if (options.bundler === 'esbuild') {
          ruleOptions.ignoredFiles ??= [];
          ruleOptions.ignoredFiles.push(
            '{projectRoot}/esbuild.config.{js,ts,mjs,mts}'
          );
          o.rules['@nx/dependency-checks'] = [ruleSeverity, ruleOptions];
        }
        return o;
      }
    );
  }
  return task;
}

function addBabelRc(tree: Tree, options: NormalizedLibraryGeneratorOptions) {
  const filename = '.babelrc';

  const babelrc = {
    presets: [['@nx/js/babel', { useBuiltIns: 'usage' }]],
  };

  writeJson(tree, join(options.projectRoot, filename), babelrc);
}

function createFiles(tree: Tree, options: NormalizedLibraryGeneratorOptions) {
  const { className, name, propertyName } = names(
    options.projectNames.projectFileName
  );

  createProjectTsConfigs(tree, options);

  generateFiles(tree, join(__dirname, './files/lib'), options.projectRoot, {
    ...options,
    dot: '.',
    className,
    name,
    propertyName,
    js: !!options.js,
    cliCommand: 'nx',
    strict: undefined,
    tmpl: '',
    offsetFromRoot: offsetFromRoot(options.projectRoot),
    buildable: options.bundler && options.bundler !== 'none',
    hasUnitTestRunner: options.unitTestRunner !== 'none',
  });

  if (!options.rootProject) {
    generateFiles(
      tree,
      join(__dirname, './files/readme'),
      options.projectRoot,
      {
        ...options,
        dot: '.',
        className,
        name,
        propertyName,
        js: !!options.js,
        cliCommand: 'nx',
        strict: undefined,
        tmpl: '',
        offsetFromRoot: offsetFromRoot(options.projectRoot),
        buildable: options.bundler && options.bundler !== 'none',
        hasUnitTestRunner: options.unitTestRunner !== 'none',
      }
    );
  }

  if (options.bundler === 'swc' || options.bundler === 'rollup') {
    addSwcConfig(
      tree,
      options.projectRoot,
      options.bundler === 'swc' ? 'commonjs' : 'es6'
    );
  } else if (options.includeBabelRc) {
    addBabelRc(tree, options);
  }

  if (options.unitTestRunner === 'none') {
    tree.delete(
      join(options.projectRoot, 'src/lib', `${options.fileName}.spec.ts`)
    );
    tree.delete(
      join(options.projectRoot, 'src/app', `${options.fileName}.spec.ts`)
    );
  }

  if (options.js) {
    toJS(tree);
  }

  const packageJsonPath = joinPathFragments(
    options.projectRoot,
    'package.json'
  );
  if (tree.exists(packageJsonPath)) {
    updateJson<PackageJson>(tree, packageJsonPath, (json) => {
      json.name = options.importPath;
      json.version = '0.0.1';
      // If the package is publishable or root/standalone, we should remove the private field.
      if (json.private && (options.publishable || options.rootProject)) {
        delete json.private;
      }
      if (!options.publishable && !options.rootProject) {
        json.private = true;
      }
      if (options.isUsingTsSolutionConfig && options.publishable) {
        // package.json and README.md are always included by default
        // https://docs.npmjs.com/cli/v10/configuring-npm/package-json#files
        json.files = ['dist', '!**/*.tsbuildinfo'];
      }
      return {
        ...json,
        dependencies: {
          ...json.dependencies,
          ...determineDependencies(options),
        },
        ...determineEntryFields(options),
      };
    });
  } else {
    const packageJson: PackageJson = {
      name: options.importPath,
      version: '0.0.1',
      dependencies: determineDependencies(options),
      ...determineEntryFields(options),
    };
    if (!options.publishable && !options.rootProject) {
      packageJson.private = true;
    }
    if (options.isUsingTsSolutionConfig && options.publishable) {
      // package.json and README.md are always included by default
      // https://docs.npmjs.com/cli/v10/configuring-npm/package-json#files
      packageJson.files = ['dist', '!**/*.tsbuildinfo'];
    }
    writeJson<PackageJson>(tree, packageJsonPath, packageJson);
  }

  if (options.config === 'npm-scripts') {
    updateJson(tree, packageJsonPath, (json) => {
      json.scripts = {
        build: "echo 'implement build'",
        test: "echo 'implement test'",
      };
      return json;
    });
  }

  if (options.minimal && !(options.projectRoot === '.')) {
    tree.delete(join(options.projectRoot, 'README.md'));
  }
}

async function addJest(
  tree: Tree,
  options: NormalizedLibraryGeneratorOptions
): Promise<GeneratorCallback> {
  const { configurationGenerator } = ensurePackage('@nx/jest', nxVersion);
  return await configurationGenerator(tree, {
    ...options,
    project: options.name,
    setupFile: 'none',
    supportTsx: false,
    skipSerializers: true,
    testEnvironment: options.testEnvironment,
    skipFormat: true,
    compiler:
      options.bundler === 'swc' || options.bundler === 'tsc'
        ? options.bundler
        : options.bundler === 'rollup'
        ? 'swc'
        : undefined,
    runtimeTsconfigFileName: 'tsconfig.lib.json',
  });
}

function replaceJestConfig(
  tree: Tree,
  options: NormalizedLibraryGeneratorOptions
) {
  const filesDir = join(__dirname, './files/jest-config');
  // the existing config has to be deleted otherwise the new config won't overwrite it
  const existingJestConfig = joinPathFragments(
    filesDir,
    `jest.config.${options.js ? 'js' : 'ts'}`
  );
  if (tree.exists(existingJestConfig)) {
    tree.delete(existingJestConfig);
  }
  const jestPreset = findRootJestPreset(tree) ?? 'jest.presets.js';

  // replace with JS:SWC specific jest config
  generateFiles(tree, filesDir, options.projectRoot, {
    ext: options.js ? 'js' : 'ts',
    jestPreset,
    js: !!options.js,
    project: options.name,
    offsetFromRoot: offsetFromRoot(options.projectRoot),
    projectRoot: options.projectRoot,
    testEnvironment: options.testEnvironment,
  });
}

function isNonInteractive(): boolean {
  return (
    isCI() || !process.stdout.isTTY || process.env.NX_INTERACTIVE !== 'true'
  );
}

async function promptWhenInteractive<T>(
  questions: Parameters<typeof prompt>[0],
  defaultValue: T
): Promise<T> {
  if (isNonInteractive()) {
    return defaultValue;
  }

  return await prompt(questions);
}

async function normalizeOptions(
  tree: Tree,
  options: LibraryGeneratorSchema
): Promise<NormalizedLibraryGeneratorOptions> {
  await ensureProjectName(tree, options, 'library');
  const nxJson = readNxJson(tree);
  options.addPlugin ??=
    process.env.NX_ADD_PLUGINS !== 'false' &&
    nxJson.useInferencePlugins !== false;

  const hasPlugin = isUsingTypeScriptPlugin(tree);
  const isUsingTsSolutionConfig = isUsingTsSolutionSetup(tree);

  if (isUsingTsSolutionConfig) {
    if (options.bundler === 'esbuild' || options.bundler === 'swc') {
      throw new Error(
        `Cannot use the "${options.bundler}" bundler when using the @nx/js/typescript plugin.`
      );
    }

    if (options.bundler === undefined && options.compiler === undefined) {
      options.bundler = await promptWhenInteractive<{ bundler: Bundler }>(
        {
          type: 'select',
          name: 'bundler',
          message: `Which bundler would you like to use to build the library? Choose 'none' to skip build setup.`,
          choices: [
            { name: 'tsc' },
            { name: 'rollup' },
            { name: 'vite' },
            { name: 'none' },
          ],
          initial: 0,
        },
        { bundler: 'tsc' }
      ).then(({ bundler }) => bundler);
    }

    options.linter ??= await promptWhenInteractive<{
      linter: 'none' | 'eslint';
    }>(
      {
        type: 'select',
        name: 'linter',
        message: `Which linter would you like to use?`,
        choices: [{ name: 'none' }, { name: 'eslint' }],
        initial: 0,
      },
      { linter: 'none' }
    ).then(({ linter }) => linter);

    options.unitTestRunner ??= await promptWhenInteractive<{
      unitTestRunner: 'none' | 'jest' | 'vitest';
    }>(
      {
        type: 'select',
        name: 'unitTestRunner',
        message: `Which unit test runner would you like to use?`,
        choices: [{ name: 'none' }, { name: 'vitest' }, { name: 'jest' }],
        initial: 0,
      },
      { unitTestRunner: 'none' }
    ).then(({ unitTestRunner }) => unitTestRunner);
  } else {
    if (options.bundler === undefined && options.compiler === undefined) {
      options.bundler = await promptWhenInteractive<{ bundler: Bundler }>(
        {
          type: 'select',
          name: 'bundler',
          message: `Which bundler would you like to use to build the library? Choose 'none' to skip build setup.`,
          choices: [
            { name: 'swc' },
            { name: 'tsc' },
            { name: 'rollup' },
            { name: 'vite' },
            { name: 'esbuild' },
            { name: 'none' },
          ],
          initial: 1,
        },
        { bundler: 'tsc' }
      ).then(({ bundler }) => bundler);
    } else {
      /**
       * We are deprecating the compiler and the buildable options.
       * However, we want to keep the existing behavior for now.
       *
       * So, if the user has not provided a bundler, we will use the compiler option, if any.
       *
       * If the user has not provided a bundler and no compiler, but has set buildable to true,
       * we will use tsc, since that is the compiler the old generator used to default to, if buildable was true
       * and no compiler was provided.
       *
       * If the user has not provided a bundler and no compiler, and has not set buildable to true, then
       * set the bundler to tsc, to preserve old default behaviour (buildable: true by default).
       *
       * If it's publishable, we need to build the code before publishing it, so again
       * we default to `tsc`. In the previous version of this, it would set `buildable` to true
       * and that would default to `tsc`.
       *
       * In the past, the only way to get a non-buildable library was to set buildable to false.
       * Now, the only way to get a non-buildble library is to set bundler to none.
       * By default, with nothing provided, libraries are buildable with `@nx/js:tsc`.
       */

      options.bundler ??= options.compiler;
    }

    options.linter ??= await promptWhenInteractive<{
      linter: 'none' | 'eslint';
    }>(
      {
        type: 'select',
        name: 'linter',
        message: `Which linter would you like to use?`,
        choices: [{ name: 'eslint' }, { name: 'none' }],
        initial: 0,
      },
      { linter: 'eslint' }
    ).then(({ linter }) => linter);

    options.unitTestRunner ??= await promptWhenInteractive<{
      unitTestRunner: 'none' | 'jest' | 'vitest';
    }>(
      {
        type: 'select',
        name: 'unitTestRunner',
        message: `Which unit test runner would you like to use?`,
        choices: [{ name: 'jest' }, { name: 'vitest' }, { name: 'none' }],
        initial: 0,
      },
      { unitTestRunner: undefined }
    ).then(({ unitTestRunner }) => unitTestRunner);

    if (!options.unitTestRunner && options.bundler === 'vite') {
      options.unitTestRunner = 'vitest';
    } else if (!options.unitTestRunner && options.config !== 'npm-scripts') {
      options.unitTestRunner = 'jest';
    }
  }

  // ensure programmatic runs have an expected default
  if (!options.config) {
    options.config = 'project';
  }

  if (options.publishable) {
    if (!options.importPath) {
      throw new Error(
        `For publishable libs you have to provide a proper "--importPath" which needs to be a valid npm package name (e.g. my-awesome-lib or @myorg/my-lib)`
      );
    }

    if (options.bundler === 'none') {
      throw new Error(
        `Publishable libraries can't be generated with "--bundler=none". Please select a valid bundler.`
      );
    }
  }

  // This is to preserve old behavior, buildable: false
  if (options.publishable === false && options.buildable === false) {
    options.bundler = 'none';
  }

  if (options.config === 'npm-scripts') {
    options.unitTestRunner = 'none';
    options.linter = 'none';
    options.bundler = 'none';
  }

  if (
    (options.bundler === 'swc' || options.bundler === 'rollup') &&
    options.skipTypeCheck == null
  ) {
    options.skipTypeCheck = false;
  }

  const {
    projectName,
    names: projectNames,
    projectRoot,
    importPath,
  } = await determineProjectNameAndRootOptions(tree, {
    name: options.name,
    projectType: 'library',
    directory: options.directory,
    importPath: options.importPath,
    rootProject: options.rootProject,
  });
  options.rootProject = projectRoot === '.';
  const fileName = names(
    options.simpleName
      ? projectNames.projectSimpleName
      : projectNames.projectFileName
  ).fileName;

  const parsedTags = options.tags
    ? options.tags.split(',').map((s) => s.trim())
    : [];

  options.minimal ??= false;

  const projectPackageManagerWorkspaceState =
    getProjectPackageManagerWorkspaceState(tree, projectRoot);

  // We default to generate a project.json file if the new setup is not being used
  options.useProjectJson ??= !isUsingTsSolutionConfig;

  return {
    ...options,
    fileName,
    name: projectName,
    projectNames,
    projectRoot,
    parsedTags,
    importPath,
    hasPlugin,
    isUsingTsSolutionConfig,
    projectPackageManagerWorkspaceState,
  };
}

function addProjectDependencies(
  tree: Tree,
  options: NormalizedLibraryGeneratorOptions
): GeneratorCallback {
  if (options.bundler == 'esbuild') {
    return addDependenciesToPackageJson(
      tree,
      {},
      {
        '@nx/esbuild': nxVersion,
        '@types/node': typesNodeVersion,
        esbuild: esbuildVersion,
      }
    );
  } else if (options.bundler == 'rollup') {
    const { dependencies, devDependencies } = getSwcDependencies();
    return addDependenciesToPackageJson(
      tree,
      { ...dependencies },
      {
        ...devDependencies,
        '@nx/rollup': nxVersion,
        '@types/node': typesNodeVersion,
      }
    );
  } else if (options.bundler === 'tsc') {
    return addDependenciesToPackageJson(
      tree,
      {},
      { tslib: tsLibVersion, '@types/node': typesNodeVersion }
    );
  } else if (options.bundler === 'swc') {
    const { dependencies, devDependencies } = getSwcDependencies();
    return addDependenciesToPackageJson(
      tree,
      { ...dependencies },
      { ...devDependencies, '@types/node': typesNodeVersion }
    );
  } else {
    return addDependenciesToPackageJson(
      tree,
      {},
      { '@types/node': typesNodeVersion }
    );
  }

  // Vite is being installed in the next step if bundler is vite
  // noop
  return () => {};
}

function getBuildExecutor(bundler: Bundler) {
  switch (bundler) {
    case 'esbuild':
      return `@nx/esbuild:esbuild`;
    case 'rollup':
      return `@nx/rollup:rollup`;
    case 'swc':
    case 'tsc':
      return `@nx/js:${bundler}`;
    case 'vite':
      return `@nx/vite:build`;
    case 'none':
    default:
      return undefined;
  }
}

function getOutputPath(options: NormalizedLibraryGeneratorOptions) {
  const parts = [defaultOutputDirectory];
  if (options.projectRoot === '.') {
    parts.push(options.name);
  } else {
    parts.push(options.projectRoot);
  }
  return joinPathFragments(...parts);
}

function createProjectTsConfigs(
  tree: Tree,
  options: NormalizedLibraryGeneratorOptions
) {
  const rootOffset = offsetFromRoot(options.projectRoot);

  let compilerOptionOverrides: Record<keyof CompilerOptions, any> = {
    module: options.isUsingTsSolutionConfig
      ? options.bundler === 'rollup'
        ? 'esnext'
        : 'nodenext'
      : 'commonjs',
    ...(options.isUsingTsSolutionConfig
      ? options.bundler === 'rollup'
        ? { moduleResolution: 'bundler' }
        : { moduleResolution: 'nodenext' }
      : {}),
    ...(options.js ? { allowJs: true } : {}),
    ...(options.strict
      ? {
          forceConsistentCasingInFileNames: true,
          strict: true,
          importHelpers: true,
          noImplicitOverride: true,
          noImplicitReturns: true,
          noFallthroughCasesInSwitch: true,
          ...(!options.isUsingTsSolutionConfig
            ? { noPropertyAccessFromIndexSignature: true }
            : {}),
        }
      : {}),
  };

  if (!options.rootProject || options.isUsingTsSolutionConfig) {
    // filter out options already set with the same value in root tsconfig file that we're going to extend from
    compilerOptionOverrides = getNeededCompilerOptionOverrides(
      tree,
      compilerOptionOverrides,
      // must have been created by now
      getRootTsConfigFileName(tree)!
    );
  }

  // tsconfig.lib.json
  generateFiles(
    tree,
    join(
      __dirname,
      'files/tsconfig-lib',
      options.isUsingTsSolutionConfig ? 'ts-solution' : 'non-ts-solution'
    ),
    options.projectRoot,
    {
      ...options,
      offsetFromRoot: rootOffset,
      js: !!options.js,
      compilerOptions: Object.entries(compilerOptionOverrides)
        .map(([k, v]) => `${JSON.stringify(k)}: ${JSON.stringify(v)}`)
        .join(',\n    '),
      tmpl: '',
    }
  );

  // tsconfig.json
  if (options.isUsingTsSolutionConfig) {
    if (options.rootProject) {
      // the root tsconfig.json is already created with the expected settings
      // for the TS plugin, we just need to update it with the project-specific
      // settings
      updateJson(tree, 'tsconfig.json', (json) => {
        json.references.push({
          path: './tsconfig.lib.json',
        });
        return json;
      });
    } else {
      // create a new tsconfig.json for the project
      const tsconfig = {
        extends: getRelativePathToRootTsConfig(tree, options.projectRoot),
        files: [],
        include: [],
        references: [{ path: './tsconfig.lib.json' }],
      };
      writeJson(
        tree,
        joinPathFragments(options.projectRoot, 'tsconfig.json'),
        tsconfig
      );

      // update root project tsconfig.json references with the new lib tsconfig
      updateJson(tree, 'tsconfig.json', (json) => {
        json.references ??= [];
        json.references.push({
          path: options.projectRoot.startsWith('./')
            ? options.projectRoot
            : './' + options.projectRoot,
        });
        return json;
      });
    }

    return;
  }

  const tsconfig = {
    extends: options.rootProject
      ? undefined
      : getRelativePathToRootTsConfig(tree, options.projectRoot),
    compilerOptions: {
      ...(options.rootProject ? tsConfigBaseOptions : {}),
      ...compilerOptionOverrides,
    },
    files: [],
    include: [],
    references: [
      {
        path: './tsconfig.lib.json',
      },
    ],
  };
  writeJson(
    tree,
    joinPathFragments(options.projectRoot, 'tsconfig.json'),
    tsconfig
  );
}

function determineDependencies(
  options: LibraryGeneratorSchema
): Record<string, string> {
  switch (options.bundler) {
    case 'tsc':
      // importHelpers is true by default, so need to add tslib as a dependency.
      return {
        tslib: tsLibVersion,
      };
    case 'swc':
      // externalHelpers is true  by default, so need to add swc helpers as a dependency.
      return {
        '@swc/helpers': swcHelpersVersion,
      };
    default: {
      // In other cases (vite, rollup, esbuild), helpers are bundled so no need to add them as a dependency.
      return {};
    }
  }
}

type EntryField = string | { [key: string]: EntryField };

function determineEntryFields(
  options: NormalizedLibraryGeneratorOptions
): Record<string, EntryField> {
  switch (options.bundler) {
    case 'tsc':
      return {
        type: 'commonjs',
        main: options.isUsingTsSolutionConfig
          ? './dist/index.js'
          : './src/index.js',
        typings: options.isUsingTsSolutionConfig
          ? './dist/index.d.ts'
          : './src/index.d.ts',
      };
    case 'swc':
      return {
        type: 'commonjs',
        main: './src/index.js',
        typings: './src/index.d.ts',
      };
    case 'rollup':
      return {
        // Since we're publishing both formats, skip the type field.
        // Bundlers or Node will determine the entry point to use.
        main: options.isUsingTsSolutionConfig
          ? './dist/index.cjs'
          : './index.cjs',
        module: options.isUsingTsSolutionConfig
          ? './dist/index.js'
          : './index.js',
      };
    case 'vite':
      return {
        // Since we're publishing both formats, skip the type field.
        // Bundlers or Node will determine the entry point to use.
        main: options.isUsingTsSolutionConfig
          ? './dist/index.js'
          : './index.js',
        module: options.isUsingTsSolutionConfig
          ? './dist/index.mjs'
          : './index.mjs',
        typings: options.isUsingTsSolutionConfig
          ? './dist/index.d.ts'
          : './index.d.ts',
      };
    case 'esbuild':
      // For libraries intended for Node, use CJS.
      return {
        type: 'commonjs',
        main: './index.cjs',
        // typings is missing for esbuild currently
      };
    default: {
      return {
        // Safest option is to not set a type field.
        // Allow the user to decide which module format their library is using
        type: undefined,
      };
    }
  }
}

function projectsConfigMatchesProject(
  projectsConfig: string | string[] | undefined,
  project: ProjectGraphProjectNode
): boolean {
  if (!projectsConfig) {
    return false;
  }

  if (typeof projectsConfig === 'string') {
    projectsConfig = [projectsConfig];
  }

  const graph: Record<string, ProjectGraphProjectNode> = {
    [project.name]: project,
  };

  const matchingProjects = findMatchingProjects(projectsConfig, graph);

  return matchingProjects.includes(project.name);
}

async function addProjectToNxReleaseConfig(
  tree: Tree,
  options: NormalizedLibraryGeneratorOptions,
  projectConfiguration: ProjectConfiguration
) {
  const nxJson = readNxJson(tree);

  const addPreVersionCommand = () => {
    const pmc = getPackageManagerCommand();

    nxJson.release = {
      ...nxJson.release,
      version: {
        preVersionCommand: `${pmc.dlx} nx run-many -t build`,
        ...nxJson.release?.version,
      },
    };
  };

  if (!nxJson.release || (!nxJson.release.projects && !nxJson.release.groups)) {
    // skip adding any projects configuration since the new project should be
    // automatically included by nx release's default project detection logic
    addPreVersionCommand();
    writeJson(tree, 'nx.json', nxJson);
    return;
  }

  const project: ProjectGraphProjectNode = {
    name: options.name,
    type: 'lib' as const,
    data: {
      root: projectConfiguration.root,
      tags: projectConfiguration.tags,
    },
  };

  if (projectsConfigMatchesProject(nxJson.release.projects, project)) {
    output.log({
      title: `Project already included in existing release configuration`,
    });
    addPreVersionCommand();
    writeJson(tree, 'nx.json', nxJson);
    return;
  }

  if (Array.isArray(nxJson.release.projects)) {
    nxJson.release.projects.push(options.name);
    addPreVersionCommand();
    writeJson(tree, 'nx.json', nxJson);
    output.log({
      title: `Added project to existing release configuration`,
    });
  }

  if (nxJson.release.groups) {
    const allGroups = Object.entries(nxJson.release.groups);

    for (const [name, group] of allGroups) {
      if (projectsConfigMatchesProject(group.projects, project)) {
        addPreVersionCommand();
        writeJson(tree, 'nx.json', nxJson);
        return `Project already included in existing release configuration for group ${name}`;
      }
    }

    output.warn({
      title: `Could not find a release group that includes ${options.name}`,
      bodyLines: [
        `Ensure that ${options.name} is included in a release group's "projects" list in nx.json so it can be published with "nx release"`,
      ],
    });
    addPreVersionCommand();
    writeJson(tree, 'nx.json', nxJson);
    return;
  }

  if (typeof nxJson.release.projects === 'string') {
    nxJson.release.projects = [nxJson.release.projects, options.name];
    addPreVersionCommand();
    writeJson(tree, 'nx.json', nxJson);
    output.log({
      title: `Added project to existing release configuration`,
    });
    return;
  }
}

function logNxReleaseDocsInfo() {
  output.log({
    title: `📦 To learn how to publish this library, see https://nx.dev/core-features/manage-releases.`,
  });
}

function findRootJestPreset(tree: Tree): string | null {
  const ext = ['js', 'cjs', 'mjs'].find((ext) =>
    tree.exists(`jest.preset.${ext}`)
  );

  return ext ? `jest.preset.${ext}` : null;
}

export default libraryGenerator;
