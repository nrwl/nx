import {
  Tree,
  convertNxGenerator,
  names,
  offsetFromRoot,
  generateFiles,
  toJS,
  getWorkspaceLayout,
  addProjectConfiguration,
  formatFiles,
  updateJson,
  GeneratorCallback,
  joinPathFragments,
  ProjectConfiguration,
  addDependenciesToPackageJson,
} from '@nrwl/devkit';
import { join } from 'path';
import { runTasksInSerial } from '../../utilities/run-tasks-in-serial';
import {
  getRelativePathToRootTsConfig,
  getRootTsConfigPathInTree,
} from '../../utilities/typescript';
import { nxVersion } from '../../utils/versions';
import { Schema } from './schema';

// nx-ignore-next-line
const { jestProjectGenerator } = require('@nrwl/jest');
// nx-ignore-next-line
const { lintProjectGenerator, Linter } = require('@nrwl/linter');

export interface NormalizedSchema extends Schema {
  name: string;
  fileName: string;
  projectRoot: string;
  projectDirectory: string;
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
    const { libsDir } = getWorkspaceLayout(tree);
    addDependenciesToPackageJson(tree, {}, { '@nrwl/js': nxVersion });
    projectConfiguration.targets.build = {
      executor: '@nrwl/js:tsc',
      outputs: ['{options.outputPath}'],
      options: {
        outputPath: `dist/${libsDir}/${options.projectDirectory}`,
        main: `${options.projectRoot}/src/index` + (options.js ? '.js' : '.ts'),
        tsConfig: `${options.projectRoot}/tsconfig.lib.json`,
        assets: [`${options.projectRoot}/*.md`],
      },
    };
  }

  addProjectConfiguration(
    tree,
    options.name,
    projectConfiguration,
    options.standaloneConfig
  );
}

export function addLint(
  tree: Tree,
  options: NormalizedSchema
): Promise<GeneratorCallback> {
  return lintProjectGenerator(tree, {
    project: options.name,
    linter: options.linter,
    skipFormat: true,
    tsConfigPaths: [
      joinPathFragments(options.projectRoot, 'tsconfig.lib.json'),
    ],
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
  return await jestProjectGenerator(tree, {
    project: options.name,
    setupFile: 'none',
    supportTsx: true,
    babelJest: options.babelJest,
    skipSerializers: true,
    testEnvironment: options.testEnvironment,
    skipFormat: true,
  });
}

export async function libraryGenerator(tree: Tree, schema: Schema) {
  const options = normalizeOptions(tree, schema);

  createFiles(tree, options);

  if (!options.skipTsConfig) {
    updateRootTsConfig(tree, options);
  }
  addProject(tree, options);

  const tasks: GeneratorCallback[] = [];

  if (options.linter !== 'none') {
    const lintCallback = await addLint(tree, options);
    tasks.push(lintCallback);
  }
  if (options.unitTestRunner === 'jest') {
    const jestCallback = await addJest(tree, options);
    tasks.push(jestCallback);
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
  const projectDirectory = options.directory
    ? `${names(options.directory).fileName}/${name}`
    : name;

  if (!options.unitTestRunner) {
    options.unitTestRunner = 'jest';
  }

  if (!options.linter) {
    options.linter = Linter.EsLint;
  }

  const projectName = projectDirectory.replace(new RegExp('/', 'g'), '-');
  const fileName = getCaseAwareFileName({
    fileName: options.simpleModuleName ? name : projectName,
    pascalCaseFiles: options.pascalCaseFiles,
  });

  const { libsDir, npmScope } = getWorkspaceLayout(tree);

  const projectRoot = joinPathFragments(libsDir, projectDirectory);

  const parsedTags = options.tags
    ? options.tags.split(',').map((s) => s.trim())
    : [];

  const defaultImportPath = `@${npmScope}/${projectDirectory}`;
  const importPath = options.importPath || defaultImportPath;

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
