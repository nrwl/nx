import {
  addDependenciesToPackageJson,
  addProjectConfiguration,
  convertNxGenerator,
  ensurePackage,
  extractLayoutDirectory,
  formatFiles,
  generateFiles,
  GeneratorCallback,
  getWorkspaceLayout,
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
} from '../../utils/typescript/ts-config';
import { join } from 'path';
import { addMinimalPublishScript } from '../../utils/minimal-publish-script';
import { Bundler, LibraryGeneratorSchema } from '../../utils/schema';
import { addSwcConfig } from '../../utils/swc/add-swc-config';
import { addSwcDependencies } from '../../utils/swc/add-swc-dependencies';
import { getImportPath } from '../../utils/get-import-path';
import {
  esbuildVersion,
  nxVersion,
  typesNodeVersion,
} from '../../utils/versions';
import jsInitGenerator from '../init/init';
import { PackageJson } from 'nx/src/utils/package-json';
import setupVerdaccio from '../setup-verdaccio/generator';
import { tsConfigBaseOptions } from '../../utils/typescript/create-ts-config';

export async function libraryGenerator(
  tree: Tree,
  schema: LibraryGeneratorSchema
) {
  const { layoutDirectory, projectDirectory } = extractLayoutDirectory(
    schema.directory
  );
  schema.directory = projectDirectory;
  const libsDir = schema.rootProject
    ? '.'
    : layoutDirectory ?? getWorkspaceLayout(tree).libsDir;
  return projectGenerator(tree, schema, libsDir, join(__dirname, './files'));
}

export async function projectGenerator(
  tree: Tree,
  schema: LibraryGeneratorSchema,
  destinationDir: string,
  filesDir: string
) {
  const tasks: GeneratorCallback[] = [];
  tasks.push(
    await jsInitGenerator(tree, {
      ...schema,
      skipFormat: true,
      tsConfigName: schema.rootProject ? 'tsconfig.json' : 'tsconfig.base.json',
    })
  );
  const options = normalizeOptions(tree, schema, destinationDir);

  createFiles(tree, options, `${filesDir}/lib`);

  addProject(tree, options, destinationDir);

  tasks.push(addProjectDependencies(tree, options));

  if (options.publishable) {
    tasks.push(await setupVerdaccio(tree, { ...options, skipFormat: true }));
  }

  if (options.bundler === 'vite') {
    const { viteConfigurationGenerator } = ensurePackage('@nx/vite', nxVersion);
    const viteTask = await viteConfigurationGenerator(tree, {
      project: options.name,
      newProject: true,
      uiFramework: 'none',
      includeVitest: options.unitTestRunner === 'vitest',
      includeLib: true,
      skipFormat: true,
      testEnvironment: options.testEnvironment,
    });
    tasks.push(viteTask);
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
    const { vitestGenerator } = ensurePackage('@nx/vite', nxVersion);
    const vitestTask = await vitestGenerator(tree, {
      project: options.name,
      uiFramework: 'none',
      coverageProvider: 'c8',
      skipFormat: true,
      testEnvironment: options.testEnvironment,
    });
    tasks.push(vitestTask);
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

  if (!options.skipFormat) {
    await formatFiles(tree);
  }

  return runTasksInSerial(...tasks);
}

export interface NormalizedSchema extends LibraryGeneratorSchema {
  name: string;
  fileName: string;
  projectRoot: string;
  projectDirectory: string;
  parsedTags: string[];
  importPath?: string;
}

function addProject(
  tree: Tree,
  options: NormalizedSchema,
  destinationDir: string
) {
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
    const outputPath = getOutputPath(options, destinationDir);
    projectConfiguration.targets.build = {
      executor: getBuildExecutor(options.bundler),
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
    }

    if (options.bundler === 'rollup') {
      projectConfiguration.targets.build.options.project = `${options.projectRoot}/package.json`;
      projectConfiguration.targets.build.options.compiler = 'swc';
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

export async function addLint(
  tree: Tree,
  options: NormalizedSchema
): Promise<GeneratorCallback> {
  const { lintProjectGenerator } = ensurePackage('@nx/linter', nxVersion);
  return lintProjectGenerator(tree, {
    project: options.name,
    linter: options.linter,
    skipFormat: true,
    tsConfigPaths: [
      joinPathFragments(options.projectRoot, 'tsconfig.lib.json'),
    ],
    unitTestRunner: options.unitTestRunner,
    eslintFilePatterns: [
      `${options.projectRoot}/**/*.${options.js ? 'js' : 'ts'}`,
    ],
    setParserOptionsProject: options.setParserOptionsProject,
    rootProject: options.rootProject,
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
  const { className, name, propertyName } = names(options.name);

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
      json.type = 'commonjs';
      // If the package is publishable, we should remove the private field.
      if (json.private && options.publishable) {
        delete json.private;
      }
      return json;
    });
  } else {
    writeJson<PackageJson>(tree, packageJsonPath, {
      name: options.importPath,
      version: '0.0.1',
      type: 'commonjs',
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
  const { jestProjectGenerator } = ensurePackage('@nx/jest', nxVersion);
  return await jestProjectGenerator(tree, {
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

function normalizeOptions(
  tree: Tree,
  options: LibraryGeneratorSchema,
  destinationDir: string
): NormalizedSchema {
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

  const { Linter } = ensurePackage('@nx/linter', nxVersion);
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

  const name = names(options.name).fileName;
  const projectDirectory = options.directory
    ? `${names(options.directory).fileName}/${name}`
    : options.rootProject
    ? '.'
    : name;

  if (!options.unitTestRunner && options.bundler === 'vite') {
    options.unitTestRunner = 'vitest';
  } else if (!options.unitTestRunner && options.config !== 'npm-scripts') {
    options.unitTestRunner = 'jest';
  }

  if (!options.linter && options.config !== 'npm-scripts') {
    options.linter = Linter.EsLint;
  }

  const projectName = options.rootProject
    ? name
    : projectDirectory.replace(new RegExp('/', 'g'), '-');
  const fileName = getCaseAwareFileName({
    fileName: options.simpleName ? name : projectName,
    pascalCaseFiles: options.pascalCaseFiles,
  });

  const projectRoot = joinPathFragments(destinationDir, projectDirectory);

  const parsedTags = options.tags
    ? options.tags.split(',').map((s) => s.trim())
    : [];

  const importPath =
    options.importPath || getImportPath(tree, projectDirectory);

  options.minimal ??= false;

  return {
    ...options,
    fileName,
    name: projectName,
    projectRoot,
    projectDirectory,
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

function getOutputPath(options: NormalizedSchema, destinationDir?: string) {
  const parts = ['dist'];
  if (destinationDir) {
    parts.push(destinationDir);
  }
  if (options.projectDirectory === '.') {
    parts.push(options.name);
  } else {
    parts.push(options.projectDirectory);
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

export default libraryGenerator;
export const librarySchematic = convertNxGenerator(libraryGenerator);
