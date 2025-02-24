import {
  addDependenciesToPackageJson,
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
  ensureRootProjectName,
} from '@nx/devkit/src/generators/project-name-and-root-utils';
import { promptWhenInteractive } from '@nx/devkit/src/generators/prompt';
import { addBuildTargetDefaults } from '@nx/devkit/src/generators/target-defaults-utils';
import { logShowProjectCommand } from '@nx/devkit/src/utils/log-show-project-command';
import { type PackageJson } from 'nx/src/utils/package-json';
import { join } from 'path';
import type { CompilerOptions } from 'typescript';
import { normalizeLinterOption } from '../../utils/generator-prompts';
import { getUpdatedPackageJsonContent } from '../../utils/package-json/update-package-json';
import { addSwcConfig } from '../../utils/swc/add-swc-config';
import { getSwcDependencies } from '../../utils/swc/add-swc-dependencies';
import { getNeededCompilerOptionOverrides } from '../../utils/typescript/configuration';
import { tsConfigBaseOptions } from '../../utils/typescript/create-ts-config';
import { ensureTypescript } from '../../utils/typescript/ensure-typescript';
import { ensureProjectIsIncludedInPluginRegistrations } from '../../utils/typescript/plugin';
import {
  addTsConfigPath,
  getRelativePathToRootTsConfig,
  getRootTsConfigFileName,
  readTsConfigFromTree,
} from '../../utils/typescript/ts-config';
import {
  addProjectToTsSolutionWorkspace,
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
import type {
  Bundler,
  LibraryGeneratorSchema,
  NormalizedLibraryGeneratorOptions,
} from './schema';
import { sortPackageJsonFields } from '../../utils/package-json/sort-fields';
import {
  addReleaseConfigForNonTsSolution,
  addReleaseConfigForTsSolution,
  releaseTasks,
} from './utils/add-release-config';

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

  // If we are using the new TS solution
  // We need to update the workspace file (package.json or pnpm-workspaces.yaml) to include the new project
  if (options.isUsingTsSolutionConfig) {
    addProjectToTsSolutionWorkspace(tree, options.projectRoot);
  }

  createFiles(tree, options);

  await configureProject(tree, options);

  if (!options.skipPackageJson) {
    tasks.push(addProjectDependencies(tree, options));
  }

  if (options.bundler === 'rollup') {
    const { configurationGenerator } = ensurePackage('@nx/rollup', nxVersion);
    await configurationGenerator(tree, {
      project: options.name,
      compiler: 'swc',
      format: options.isUsingTsSolutionConfig ? ['esm'] : ['cjs', 'esm'],
      skipFormat: true,
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

    if (
      !options.isUsingTsSolutionConfig &&
      (options.bundler === 'swc' || options.bundler === 'rollup')
    ) {
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
      addPlugin: options.addPlugin,
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
        // add project reference to the runtime tsconfig.lib.json file
        json.references ??= [];
        json.references.push({ path: './tsconfig.lib.json' });

        const compilerOptions = getCompilerOptions(options);
        // respect the module and moduleResolution set by the test runner generator
        if (json.compilerOptions.module) {
          compilerOptions.module = json.compilerOptions.module;
        }
        if (json.compilerOptions.moduleResolution) {
          compilerOptions.moduleResolution =
            json.compilerOptions.moduleResolution;
        }

        // filter out options already set with the same value in root tsconfig file that we're going to extend from
        json.compilerOptions = getNeededCompilerOptionOverrides(
          tree,
          { ...json.compilerOptions, ...compilerOptions },
          // must have been created by now
          getRootTsConfigFileName(tree)!
        );

        return json;
      }
    );
  }

  sortPackageJsonFields(tree, options.projectRoot);

  if (!options.skipFormat) {
    await formatFiles(tree);
  }

  if (options.publishable) {
    tasks.push(await releaseTasks(tree));
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

async function configureProject(
  tree: Tree,
  options: NormalizedLibraryGeneratorOptions
) {
  if (options.hasPlugin) {
    const nxJson = readNxJson(tree);
    ensureProjectIsIncludedInPluginRegistrations(nxJson, options.projectRoot);
    updateNxJson(tree, nxJson);
  }

  const projectConfiguration: ProjectConfiguration = {
    root: options.projectRoot,
    sourceRoot: joinPathFragments(options.projectRoot, 'src'),
    projectType: 'library',
    targets: {},
    tags: options.parsedTags,
  };

  if (
    options.config !== 'npm-scripts' &&
    (options.bundler === 'swc' ||
      options.bundler === 'esbuild' ||
      ((!options.isUsingTsSolutionConfig || options.useTscExecutor) &&
        options.bundler === 'tsc'))
  ) {
    const outputPath = getOutputPath(options);
    const executor = getBuildExecutor(options.bundler);
    addBuildTargetDefaults(tree, executor);

    projectConfiguration.targets.build = {
      executor,
      outputs: ['{options.outputPath}'],
      options: {
        outputPath,
        main: `${options.projectRoot}/src/index` + (options.js ? '.js' : '.ts'),
        tsConfig: `${options.projectRoot}/tsconfig.lib.json`,
      },
    };

    if (
      options.bundler === 'swc' &&
      (options.skipTypeCheck || options.isUsingTsSolutionConfig)
    ) {
      projectConfiguration.targets.build.options.skipTypeCheck = true;
    }

    if (options.isUsingTsSolutionConfig) {
      if (options.bundler === 'esbuild') {
        projectConfiguration.targets.build.options.format = ['esm'];
        projectConfiguration.targets.build.options.declarationRootDir = `${options.projectRoot}/src`;
      } else if (options.bundler === 'swc') {
        projectConfiguration.targets.build.options.stripLeadingPaths = true;
      }
    } else {
      projectConfiguration.targets.build.options.assets = [];

      if (options.bundler === 'esbuild') {
        projectConfiguration.targets.build.options.format = ['cjs'];
        projectConfiguration.targets.build.options.generatePackageJson = true;
      }

      if (!options.minimal) {
        projectConfiguration.targets.build.options.assets ??= [];
        projectConfiguration.targets.build.options.assets.push(
          joinPathFragments(options.projectRoot, '*.md')
        );
      }
    }
  }

  if (options.publishable) {
    if (options.isUsingTsSolutionConfig) {
      await addReleaseConfigForTsSolution(
        tree,
        options.name,
        projectConfiguration
      );
    } else {
      await addReleaseConfigForNonTsSolution(
        tree,
        options.name,
        projectConfiguration,
        defaultOutputDirectory
      );
    }
  }

  if (!options.useProjectJson) {
    // we want the package.json as clean as possible, with the bare minimum
    if (!projectConfiguration.tags?.length) {
      delete projectConfiguration.tags;
    }

    // We want a minimal setup, so unless targets and tags are set, just skip the `nx` property in `package.json`.
    if (options.isUsingTsSolutionConfig) {
      delete projectConfiguration.projectType;
      // SWC executor has logic around sourceRoot and `--strip-leading-paths`. If it is not set then dist will contain the `src` folder rather than being flat.
      // TODO(leo): Look at how we can remove the dependency on sourceRoot for SWC.
      if (options.bundler !== 'swc') {
        delete projectConfiguration.sourceRoot;
      }
    }

    // empty targets are cleaned up automatically by `updateProjectConfiguration`
    updateProjectConfiguration(tree, options.name, projectConfiguration);
  } else if (options.config === 'workspace' || options.config === 'project') {
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
        const ignoredFiles = new Set(ruleOptions.ignoredFiles ?? []);
        if (options.bundler === 'vite') {
          ignoredFiles.add('{projectRoot}/vite.config.{js,ts,mjs,mts}');
        } else if (options.bundler === 'rollup') {
          ignoredFiles.add(
            '{projectRoot}/rollup.config.{js,ts,mjs,mts,cjs,cts}'
          );
        } else if (options.bundler === 'esbuild') {
          ignoredFiles.add('{projectRoot}/esbuild.config.{js,ts,mjs,mts}');
        }
        if (options.unitTestRunner === 'vitest') {
          ignoredFiles.add('{projectRoot}/vite.config.{js,ts,mjs,mts}');
        }

        if (ignoredFiles.size) {
          ruleOptions.ignoredFiles = Array.from(ignoredFiles);
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

  let fileNameImport = options.fileName;
  if (options.bundler === 'vite' || options.isUsingTsSolutionConfig) {
    const tsConfig = readTsConfigFromTree(
      tree,
      join(options.projectRoot, 'tsconfig.lib.json')
    );
    const ts = ensureTypescript();
    if (
      tsConfig.options.moduleResolution === ts.ModuleResolutionKind.Node16 ||
      tsConfig.options.moduleResolution === ts.ModuleResolutionKind.NodeNext
    ) {
      // Node16 and NodeNext require explicit file extensions for relative
      // import paths. Since we generate the file with the `.ts` extension,
      // we import it from the same file with the `.js` extension.
      // https://www.typescriptlang.org/docs/handbook/modules/reference.html#file-extension-substitution
      fileNameImport = `${options.fileName}.js`;
    }
  }

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
    fileNameImport,
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
      options.bundler === 'swc' && !options.isUsingTsSolutionConfig
        ? 'commonjs'
        : 'es6'
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

      const updatedPackageJson = {
        ...json,
        dependencies: {
          ...json.dependencies,
          ...determineDependencies(options),
        },
        ...determineEntryFields(options),
      };

      if (
        options.isUsingTsSolutionConfig &&
        !['none', 'rollup', 'vite'].includes(options.bundler)
      ) {
        return getUpdatedPackageJsonContent(updatedPackageJson, {
          main: join(options.projectRoot, 'src/index.ts'),
          outputPath: joinPathFragments(options.projectRoot, 'dist'),
          projectRoot: options.projectRoot,
          rootDir: join(options.projectRoot, 'src'),
          generateExportsField: true,
          packageJsonPath,
          format: ['esm'],
        });
      }

      return updatedPackageJson;
    });
  } else {
    let packageJson: PackageJson = {
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

    if (
      options.isUsingTsSolutionConfig &&
      !['none', 'rollup', 'vite'].includes(options.bundler)
    ) {
      packageJson = getUpdatedPackageJsonContent(packageJson, {
        main: join(options.projectRoot, 'src/index.ts'),
        outputPath: joinPathFragments(options.projectRoot, 'dist'),
        projectRoot: options.projectRoot,
        rootDir: join(options.projectRoot, 'src'),
        generateExportsField: true,
        packageJsonPath,
        format: ['esm'],
      });
    }

    if (!options.useProjectJson && options.name !== options.importPath) {
      packageJson.nx = {
        name: options.name,
      };
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
  } else if (
    !options.isUsingTsSolutionConfig &&
    options.useProjectJson &&
    (!options.bundler || options.bundler === 'none') &&
    !(options.projectRoot === '.')
  ) {
    tree.delete(packageJsonPath);
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
    testEnvironment: options.testEnvironment ?? 'node',
    skipFormat: true,
    compiler: options.shouldUseSwcJest
      ? 'swc'
      : options.bundler === 'tsc'
      ? 'tsc'
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

async function normalizeOptions(
  tree: Tree,
  options: LibraryGeneratorSchema
): Promise<NormalizedLibraryGeneratorOptions> {
  await ensureRootProjectName(options, 'library');
  const nxJson = readNxJson(tree);
  options.addPlugin ??=
    process.env.NX_ADD_PLUGINS !== 'false' &&
    nxJson.useInferencePlugins !== false;

  options.linter = await normalizeLinterOption(tree, options.linter);

  const hasPlugin = isUsingTypeScriptPlugin(tree);
  const isUsingTsSolutionConfig = isUsingTsSolutionSetup(tree);

  if (isUsingTsSolutionConfig) {
    options.unitTestRunner ??= await promptWhenInteractive<{
      unitTestRunner: 'none' | 'jest' | 'vitest';
    }>(
      {
        type: 'autocomplete',
        name: 'unitTestRunner',
        message: `Which unit test runner would you like to use?`,
        choices: [{ name: 'none' }, { name: 'vitest' }, { name: 'jest' }],
        initial: 0,
      },
      { unitTestRunner: 'none' }
    ).then(({ unitTestRunner }) => unitTestRunner);
  } else {
    options.unitTestRunner ??= await promptWhenInteractive<{
      unitTestRunner: 'none' | 'jest' | 'vitest';
    }>(
      {
        type: 'autocomplete',
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
  options.bundler ??= options.compiler ?? 'tsc';

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
    (options.skipTypeCheck == null || !isUsingTsSolutionConfig)
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

  // We default to generate a project.json file if the new setup is not being used
  options.useProjectJson ??= !isUsingTsSolutionConfig;

  const shouldUseSwcJest =
    options.bundler === 'swc' ||
    options.bundler === 'rollup' ||
    isUsingTsSolutionConfig;

  return {
    ...options,
    fileName,
    name:
      isUsingTsSolutionConfig && !options.name && !options.useProjectJson
        ? importPath
        : projectName,
    projectNames,
    projectRoot,
    parsedTags,
    importPath,
    hasPlugin,
    isUsingTsSolutionConfig,
    shouldUseSwcJest,
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
  if (options.isUsingTsSolutionConfig) {
    // Executors expect paths relative to workspace root, so we prepend the project root
    return joinPathFragments(options.projectRoot, 'dist');
  }

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

  let compilerOptionOverrides = getCompilerOptions(options);
  if (options.isUsingTsSolutionConfig) {
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
      outDir:
        options.bundler === 'tsc'
          ? 'dist'
          : `out-tsc/${options.projectRoot.split('/').pop()}`,
      emitDeclarationOnly: options.bundler === 'tsc' ? false : true,
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

function getCompilerOptions(
  options: NormalizedLibraryGeneratorOptions
): Record<keyof CompilerOptions, any> {
  return {
    module: options.isUsingTsSolutionConfig
      ? options.bundler === 'rollup'
        ? 'esnext'
        : 'nodenext'
      : 'commonjs',
    ...(options.isUsingTsSolutionConfig
      ? {
          moduleResolution:
            options.bundler === 'rollup' ? 'bundler' : 'nodenext',
        }
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
    case 'swc':
      if (options.isUsingTsSolutionConfig) {
        return {
          type: 'module',
          main: './dist/index.js',
          types: './dist/index.d.ts',
        };
      } else {
        return {
          type: 'commonjs',
          main: './src/index.js',
          types: './src/index.d.ts',
        };
      }
    case 'rollup':
      if (options.isUsingTsSolutionConfig) {
        // the rollup configuration generator already handles this
        return {};
      } else {
        return {
          // Since we're publishing both formats, skip the type field.
          // Bundlers or Node will determine the entry point to use.
          main: './index.cjs',
          module: './index.js',
        };
      }
    case 'vite':
      if (options.isUsingTsSolutionConfig) {
        // the vite configuration generator already handle this
        return {};
      } else {
        return {
          type: 'module',
          main: './index.js',
          types: './index.d.ts',
        };
      }
    case 'esbuild':
      if (options.isUsingTsSolutionConfig) {
        return {
          type: 'module',
          main: './dist/index.js',
          types: './dist/index.d.ts',
        };
      } else {
        return {
          type: 'commonjs',
          main: './index.cjs',
          types: './index.d.ts',
        };
      }
    case 'none': {
      if (options.isUsingTsSolutionConfig) {
        return {
          type: 'module',
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

      return {
        // Safest option is to not set a type field.
        // Allow the user to decide which module format their library is using
        type: undefined,
      };
    }
    default: {
      return {};
    }
  }
}

function findRootJestPreset(tree: Tree): string | null {
  const ext = ['js', 'cjs', 'mjs'].find((ext) =>
    tree.exists(`jest.preset.${ext}`)
  );

  return ext ? `jest.preset.${ext}` : null;
}

export default libraryGenerator;
