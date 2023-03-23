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
} from '@nrwl/devkit';
import { getImportPath } from 'nx/src/utils/path';
import { join } from 'path';

import {
  getRelativePathToRootTsConfig,
  getRootTsConfigFileName,
  getRootTsConfigPathInTree,
} from '../../utilities/ts-config';
import { nxVersion, typescriptVersion } from '../../utils/versions';
import type { Schema } from './schema';

export interface NormalizedSchema extends Schema {
  name: string;
  fileName: string;
  projectRoot: string;
  projectDirectory: string;
  libsDir: string;
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

  if (options.buildable) {
    addDependenciesToPackageJson(tree, {}, { '@nrwl/js': nxVersion });
    projectConfiguration.targets.build = {
      executor: '@nrwl/js:tsc',
      outputs: ['{options.outputPath}'],
      options: {
        outputPath:
          options.libsDir != '.'
            ? `dist/${options.libsDir}/${options.projectDirectory}`
            : `dist/${options.projectDirectory}`,
        main: `${options.projectRoot}/src/index` + (options.js ? '.js' : '.ts'),
        tsConfig: `${options.projectRoot}/tsconfig.lib.json`,
        assets: [`${options.projectRoot}/*.md`],
      },
    };
  }

  addProjectConfiguration(tree, options.name, projectConfiguration);
}

export async function addLint(
  tree: Tree,
  options: NormalizedSchema
): Promise<GeneratorCallback> {
  const { lintProjectGenerator } = ensurePackage('@nrwl/linter', nxVersion);
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
  });
}

function updateTsConfig(tree: Tree, options: NormalizedSchema) {
  updateJson(tree, join(options.projectRoot, 'tsconfig.json'), (json) => {
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
  });
}

function updateRootTsConfig(host: Tree, options: NormalizedSchema) {
  updateJson(host, getRootTsConfigPathInTree(host), (json) => {
    const c = json.compilerOptions;
    c.paths = c.paths || {};
    delete c.paths[options.name];

    if (c.paths[options.importPath]) {
      throw new Error(
        `You already have a library using the import path "${options.importPath}". Make sure to specify a unique one.`
      );
    }

    c.paths[options.importPath] = [
      joinPathFragments(
        options.projectRoot,
        './src',
        'index.' + (options.js ? 'js' : 'ts')
      ),
    ];

    return json;
  });
}

function createFiles(tree: Tree, options: NormalizedSchema) {
  const { className, name, propertyName } = names(options.name);

  const rootOffset = offsetFromRoot(options.projectRoot);
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
    offsetFromRoot: rootOffset,
    rootTsConfigPath: getRelativePathToRootTsConfig(tree, options.projectRoot),
    hasUnitTestRunner: options.unitTestRunner !== 'none',
    hasLinter: options.linter !== 'none',
  });

  if (options.unitTestRunner === 'none') {
    tree.delete(
      join(options.projectRoot, 'src/lib', `${options.fileName}.spec.ts`)
    );
  }

  if (options.skipBabelrc) {
    tree.delete(join(options.projectRoot, '.babelrc'));
  }

  if (options.js) {
    toJS(tree);
  }

  if (!options.buildable) {
    tree.delete(join(options.projectRoot, 'package.json'));
  }

  updateTsConfig(tree, options);
}

async function addJest(
  tree: Tree,
  options: NormalizedSchema
): Promise<GeneratorCallback> {
  const { jestProjectGenerator } = ensurePackage('@nrwl/jest', nxVersion);
  return await jestProjectGenerator(tree, {
    ...options,
    project: options.name,
    setupFile: 'none',
    supportTsx: true,
    babelJest: options.babelJest,
    skipSerializers: true,
    testEnvironment: options.testEnvironment,
    skipFormat: true,
  });
}

function addTypescript(tree: Tree, options: NormalizedSchema) {
  // add tsconfig.base.json
  if (!options.skipTsConfig && !getRootTsConfigFileName()) {
    generateFiles(tree, joinPathFragments(__dirname, './files/root'), '.', {});
  }

  return !options.js
    ? addDependenciesToPackageJson(tree, {}, { typescript: typescriptVersion })
    : () => {};
}

export async function libraryGenerator(tree: Tree, schema: Schema) {
  const options = normalizeOptions(tree, schema);
  const tasks: GeneratorCallback[] = [];

  addTypescript(tree, options);
  createFiles(tree, options);
  addProject(tree, options);

  if (options.linter !== 'none') {
    const lintCallback = await addLint(tree, options);
    tasks.push(lintCallback);
  }
  if (options.unitTestRunner === 'jest') {
    const jestCallback = await addJest(tree, options);
    tasks.push(jestCallback);
  }
  if (!options.skipTsConfig) {
    updateRootTsConfig(tree, options);
  }

  if (!options.skipFormat) {
    await formatFiles(tree);
  }

  return runTasksInSerial(...tasks);
}

export default libraryGenerator;
export const librarySchematic = convertNxGenerator(libraryGenerator);

function normalizeOptions(tree: Tree, options: Schema): NormalizedSchema {
  const name = names(options.name).fileName;
  const { layoutDirectory, projectDirectory } = extractLayoutDirectory(
    options.directory ? `${names(options.directory).fileName}/${name}` : name
  );

  if (!options.unitTestRunner) {
    options.unitTestRunner = 'jest';
  }

  if (!options.linter) {
    const { Linter } = ensurePackage('@nrwl/linter', nxVersion);
    options.linter = Linter.EsLint;
  }

  const projectName = projectDirectory.replace(new RegExp('/', 'g'), '-');
  const fileName = getCaseAwareFileName({
    fileName: options.simpleModuleName ? name : projectName,
    pascalCaseFiles: options.pascalCaseFiles,
  });

  const { libsDir: defaultLibsDir, npmScope } = getWorkspaceLayout(tree);
  const libsDir = layoutDirectory ?? defaultLibsDir;

  const projectRoot = joinPathFragments(libsDir, projectDirectory);

  const parsedTags = options.tags
    ? options.tags.split(',').map((s) => s.trim())
    : [];

  const importPath =
    options.importPath || getImportPath(npmScope, projectDirectory);

  return {
    ...options,
    fileName,
    name: projectName,
    projectRoot,
    projectDirectory,
    parsedTags,
    importPath,
    libsDir,
  };
}

function getCaseAwareFileName(options: {
  pascalCaseFiles: boolean;
  fileName: string;
}) {
  const normalized = names(options.fileName);

  return options.pascalCaseFiles ? normalized.className : normalized.fileName;
}
