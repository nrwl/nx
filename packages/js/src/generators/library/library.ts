import {
  addDependenciesToPackageJson,
  addProjectConfiguration,
  ensurePackage,
  formatFiles,
  generateFiles,
  GeneratorCallback,
  joinPathFragments,
  names,
  offsetFromRoot,
  ProjectConfiguration,
  readProjectConfiguration,
  runTasksInSerial,
  toJS,
  Tree,
  updateJson,
  writeJson,
} from '@nx/devkit';
import {
  determineProjectNameAndRootOptions,
  type ProjectNameAndRootOptions,
} from '@nx/devkit/src/generators/project-name-and-root-utils';

import {
  addTsConfigPath,
  getRelativePathToRootTsConfig,
} from '../../utils/typescript/ts-config';
import { join } from 'path';
import { addMinimalPublishScript } from '../../utils/minimal-publish-script';
import { Bundler, LibraryGeneratorSchema } from '../../utils/schema';
import { addSwcConfig } from '../../utils/swc/add-swc-config';
import { addSwcDependencies } from '../../utils/swc/add-swc-dependencies';
import {
  esbuildVersion,
  nxVersion,
  swcHelpersVersion,
  tsLibVersion,
  typesNodeVersion,
} from '../../utils/versions';
import jsInitGenerator from '../init/init';
import { type PackageJson } from 'nx/src/utils/package-json';
import setupVerdaccio from '../setup-verdaccio/generator';
import { tsConfigBaseOptions } from '../../utils/typescript/create-ts-config';
import { logShowProjectCommand } from '@nx/devkit/src/utils/log-show-project-command';
import { addBuildTargetDefaults } from '@nx/devkit/src/generators/add-build-target-defaults';

export async function libraryGenerator(
  tree: Tree,
  schema: LibraryGeneratorSchema
) {
  return await libraryGeneratorInternal(tree, {
    addPlugin: false,
    // provide a default projectNameAndRootFormat to avoid breaking changes
    // to external generators invoking this one
    projectNameAndRootFormat: 'derived',
    ...schema,
  });
}

export async function libraryGeneratorInternal(
  tree: Tree,
  schema: LibraryGeneratorSchema
) {
  const filesDir = join(__dirname, './files');

  const tasks: GeneratorCallback[] = [];
  tasks.push(
    await jsInitGenerator(tree, {
      ...schema,
      skipFormat: true,
      tsConfigName: schema.rootProject ? 'tsconfig.json' : 'tsconfig.base.json',
    })
  );
  const options = await normalizeOptions(tree, schema);

  createFiles(tree, options, `${filesDir}/lib`);

  addProject(tree, options);

  if (!options.skipPackageJson) {
    tasks.push(addProjectDependencies(tree, options));
  }

  if (options.publishable) {
    tasks.push(await setupVerdaccio(tree, { ...options, skipFormat: true }));
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
      replaceJestConfig(tree, options, `${filesDir}/jest-config`);
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

  if (!schema.skipTsConfig) {
    addTsConfigPath(tree, options.importPath, [
      joinPathFragments(
        options.projectRoot,
        './src',
        'index.' + (options.js ? 'js' : 'ts')
      ),
    ]);
  }

  if (options.bundler !== 'none') {
    addBundlerDependencies(tree, options);
  }

  if (!options.skipFormat) {
    await formatFiles(tree);
  }

  tasks.push(() => {
    logShowProjectCommand(options.name);
  });

  return runTasksInSerial(...tasks);
}

export interface NormalizedSchema extends LibraryGeneratorSchema {
  name: string;
  projectNames: ProjectNameAndRootOptions['names'];
  fileName: string;
  projectRoot: string;
  parsedTags: string[];
  importPath?: string;
}

function addProject(tree: Tree, options: NormalizedSchema) {
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
        assets: [],
      },
    };

    if (options.bundler === 'esbuild') {
      projectConfiguration.targets.build.options.generatePackageJson = true;
      projectConfiguration.targets.build.options.format = ['cjs'];
    }

    if (options.bundler === 'rollup') {
      projectConfiguration.targets.build.options.project = `${options.projectRoot}/package.json`;
      projectConfiguration.targets.build.options.compiler = 'swc';
      projectConfiguration.targets.build.options.format = ['cjs', 'esm'];
    }

    if (options.bundler === 'swc' && options.skipTypeCheck) {
      projectConfiguration.targets.build.options.skipTypeCheck = true;
    }

    if (
      !options.minimal &&
      // TODO(jack): assets for rollup have validation that we need to fix (assets must be under <project-root>/src)
      options.bundler !== 'rollup'
    ) {
      projectConfiguration.targets.build.options.assets ??= [];
      projectConfiguration.targets.build.options.assets.push(
        joinPathFragments(options.projectRoot, '*.md')
      );
    }

    if (options.publishable) {
      const publishScriptPath = addMinimalPublishScript(tree);

      projectConfiguration.targets.publish = {
        command: `node ${publishScriptPath} ${options.name} {args.ver} {args.tag}`,
        dependsOn: ['build'],
      };
    }
  }

  if (options.config === 'workspace' || options.config === 'project') {
    addProjectConfiguration(tree, options.name, projectConfiguration);
  } else {
    addProjectConfiguration(
      tree,
      options.name,
      {
        root: projectConfiguration.root,
        tags: projectConfiguration.tags,
        targets: {},
      },
      true
    );
  }
}

export type AddLintOptions = Pick<
  NormalizedSchema,
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
        '@nx/dependency-checks': 'error',
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
          ruleOptions.ignoredFiles = [
            '{projectRoot}/vite.config.{js,ts,mjs,mts}',
          ];
          o.rules['@nx/dependency-checks'] = [ruleSeverity, ruleOptions];
        } else if (options.bundler === 'rollup') {
          ruleOptions.ignoredFiles = [
            '{projectRoot}/rollup.config.{js,ts,mjs,mts}',
          ];
          o.rules['@nx/dependency-checks'] = [ruleSeverity, ruleOptions];
        } else if (options.bundler === 'esbuild') {
          ruleOptions.ignoredFiles = [
            '{projectRoot}/esbuild.config.{js,ts,mjs,mts}',
          ];
          o.rules['@nx/dependency-checks'] = [ruleSeverity, ruleOptions];
        }
        return o;
      }
    );
  }
  return task;
}

function addBundlerDependencies(tree: Tree, options: NormalizedSchema) {
  updateJson(tree, `${options.projectRoot}/package.json`, (json) => {
    if (options.bundler === 'tsc') {
      json.dependencies = {
        ...json.dependencies,
        tslib: tsLibVersion,
      };
    } else if (options.bundler === 'swc') {
      json.dependencies = {
        ...json.dependencies,
        '@swc/helpers': swcHelpersVersion,
      };
    }
    return json;
  });
}

function updateTsConfig(tree: Tree, options: NormalizedSchema) {
  updateJson(tree, join(options.projectRoot, 'tsconfig.json'), (json) => {
    if (options.strict) {
      json.compilerOptions = {
        ...json.compilerOptions,
        forceConsistentCasingInFileNames: true,
        strict: true,
        noImplicitOverride: true,
        noPropertyAccessFromIndexSignature: true,
        noImplicitReturns: true,
        noFallthroughCasesInSwitch: true,
      };
    }

    return json;
  });
}

function addBabelRc(tree: Tree, options: NormalizedSchema) {
  const filename = '.babelrc';

  const babelrc = {
    presets: [['@nx/js/babel', { useBuiltIns: 'usage' }]],
  };

  writeJson(tree, join(options.projectRoot, filename), babelrc);
}

function createFiles(tree: Tree, options: NormalizedSchema, filesDir: string) {
  const { className, name, propertyName } = names(
    options.projectNames.projectFileName
  );

  createProjectTsConfigJson(tree, options);

  generateFiles(tree, filesDir, options.projectRoot, {
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

  if (options.bundler === 'swc' || options.bundler === 'rollup') {
    addSwcDependencies(tree);
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
    writeJson<PackageJson>(tree, packageJsonPath, {
      name: options.importPath,
      version: '0.0.1',
      dependencies: determineDependencies(options),
      ...determineEntryFields(options),
    });
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
    (!options.bundler || options.bundler === 'none') &&
    !(options.projectRoot === '.')
  ) {
    tree.delete(packageJsonPath);
  }

  if (options.minimal && !(options.projectRoot === '.')) {
    tree.delete(join(options.projectRoot, 'README.md'));
  }

  updateTsConfig(tree, options);
}

async function addJest(
  tree: Tree,
  options: NormalizedSchema
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
  });
}

function replaceJestConfig(
  tree: Tree,
  options: NormalizedSchema,
  filesDir: string
) {
  // the existing config has to be deleted otherwise the new config won't overwrite it
  const existingJestConfig = joinPathFragments(
    filesDir,
    `jest.config.${options.js ? 'js' : 'ts'}`
  );
  if (tree.exists(existingJestConfig)) {
    tree.delete(existingJestConfig);
  }

  // replace with JS:SWC specific jest config
  generateFiles(tree, filesDir, options.projectRoot, {
    ext: options.js ? 'js' : 'ts',
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
): Promise<NormalizedSchema> {
  options.addPlugin ??= process.env.NX_ADD_PLUGINS !== 'false';

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

  options.bundler = options.bundler ?? options.compiler ?? 'tsc';

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
      options.bundler = 'tsc';
    }
  }

  // This is to preserve old behaviour, buildable: false
  if (options.publishable === false && options.buildable === false) {
    options.bundler = 'none';
  }

  const { Linter } = ensurePackage('@nx/eslint', nxVersion);
  if (options.config === 'npm-scripts') {
    options.unitTestRunner = 'none';
    options.linter = Linter.None;
    options.bundler = 'none';
  }

  if (
    (options.bundler === 'swc' || options.bundler === 'rollup') &&
    options.skipTypeCheck == null
  ) {
    options.skipTypeCheck = false;
  }

  if (!options.unitTestRunner && options.bundler === 'vite') {
    options.unitTestRunner = 'vitest';
  } else if (!options.unitTestRunner && options.config !== 'npm-scripts') {
    options.unitTestRunner = 'jest';
  }

  if (!options.linter && options.config !== 'npm-scripts') {
    options.linter = Linter.EsLint;
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
    projectNameAndRootFormat: options.projectNameAndRootFormat,
    rootProject: options.rootProject,
    callingGenerator: '@nx/js:library',
  });
  options.rootProject = projectRoot === '.';
  const fileName = getCaseAwareFileName({
    fileName: options.simpleName
      ? projectNames.projectSimpleName
      : projectNames.projectFileName,
    pascalCaseFiles: options.pascalCaseFiles,
  });

  const parsedTags = options.tags
    ? options.tags.split(',').map((s) => s.trim())
    : [];

  options.minimal ??= false;

  return {
    ...options,
    fileName,
    name: projectName,
    projectNames,
    projectRoot,
    parsedTags,
    importPath,
  };
}

function getCaseAwareFileName(options: {
  pascalCaseFiles: boolean;
  fileName: string;
}) {
  const normalized = names(options.fileName);

  return options.pascalCaseFiles ? normalized.className : normalized.fileName;
}

function addProjectDependencies(
  tree: Tree,
  options: NormalizedSchema
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
    return addDependenciesToPackageJson(
      tree,
      {},
      { '@nx/rollup': nxVersion, '@types/node': typesNodeVersion }
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

function getOutputPath(options: NormalizedSchema) {
  const parts = ['dist'];
  if (options.projectRoot === '.') {
    parts.push(options.name);
  } else {
    parts.push(options.projectRoot);
  }
  return joinPathFragments(...parts);
}

function createProjectTsConfigJson(tree: Tree, options: NormalizedSchema) {
  const tsconfig = {
    extends: options.rootProject
      ? undefined
      : getRelativePathToRootTsConfig(tree, options.projectRoot),
    compilerOptions: {
      ...(options.rootProject ? tsConfigBaseOptions : {}),
      module: 'commonjs',
      allowJs: options.js ? true : undefined,
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
  options: LibraryGeneratorSchema
): Record<string, EntryField> {
  switch (options.bundler) {
    case 'tsc':
      return {
        type: 'commonjs',
        main: './src/index.js',
        typings: './src/index.d.ts',
      };
    case 'swc':
      return {
        type: 'commonjs',
        main: './src/index.js',
        typings: './src/index.d.ts',
      };
    case 'rollup':
      return {
        type: 'commonjs',
        main: './index.cjs',
        module: './index.js',
        // typings is missing for rollup currently
      };
    case 'vite':
      return {
        // Since we're publishing both formats, skip the type field.
        // Bundlers or Node will determine the entry point to use.
        main: './index.js',
        module: './index.mjs',
        typings: './index.d.ts',
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
        // CJS is the safest optional for now due to lack of support from some packages
        // also setting `type: module` results in different resolution behavior (e.g. import 'foo' no longer resolves to 'foo/index.js')
        type: 'commonjs',
      };
    }
  }
}

export default libraryGenerator;
