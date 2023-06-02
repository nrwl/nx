import {
  convertNxGenerator,
  extractLayoutDirectory,
  formatFiles,
  generateFiles,
  GeneratorCallback,
  getWorkspaceLayout,
  joinPathFragments,
  names,
  offsetFromRoot,
  readProjectConfiguration,
  runTasksInSerial,
  toJS,
  Tree,
  updateProjectConfiguration,
  updateTsConfigsToJs,
} from '@nx/devkit';
import { Schema } from './schema';
import { libraryGenerator as jsLibraryGenerator } from '@nx/js';

import { join } from 'path';
import { addSwcDependencies } from '@nx/js/src/utils/swc/add-swc-dependencies';
import { addSwcConfig } from '@nx/js/src/utils/swc/add-swc-config';
import { initGenerator } from '../init/init';
import { getImportPath } from '@nx/js/src/utils/get-import-path';

export interface NormalizedSchema extends Schema {
  name: string;
  fileName: string;
  projectRoot: string;
  projectDirectory: string;
  parsedTags: string[];
  compiler: 'swc' | 'tsc';
}

export async function libraryGenerator(tree: Tree, schema: Schema) {
  const options = normalizeOptions(tree, schema);
  const tasks: GeneratorCallback[] = [
    await initGenerator(tree, {
      ...options,
      skipFormat: true,
    }),
  ];

  if (options.publishable === true && !schema.importPath) {
    throw new Error(
      `For publishable libs you have to provide a proper "--importPath" which needs to be a valid npm package name (e.g. my-awesome-lib or @myorg/my-lib)`
    );
  }

  const libraryInstall = await jsLibraryGenerator(tree, {
    ...schema,
    bundler: schema.buildable ? 'tsc' : 'none',
    includeBabelRc: schema.babelJest,
    importPath: options.importPath,
    testEnvironment: 'node',
    skipFormat: true,
    setParserOptionsProject: options.setParserOptionsProject,
  });
  tasks.push(libraryInstall);
  createFiles(tree, options);

  if (options.js) {
    updateTsConfigsToJs(tree, options);
  }
  updateProject(tree, options);

  if (!schema.skipFormat) {
    await formatFiles(tree);
  }

  return runTasksInSerial(...tasks);
}

export default libraryGenerator;
export const librarySchematic = convertNxGenerator(libraryGenerator);

function normalizeOptions(tree: Tree, options: Schema): NormalizedSchema {
  const { layoutDirectory, projectDirectory } = extractLayoutDirectory(
    options.directory
  );
  const { npmScope, libsDir: defaultLibsDir } = getWorkspaceLayout(tree);
  const libsDir = layoutDirectory ?? defaultLibsDir;
  const name = names(options.name).fileName;
  const fullProjectDirectory = projectDirectory
    ? `${names(projectDirectory).fileName}/${name}`
    : name;

  const projectName = fullProjectDirectory.replace(new RegExp('/', 'g'), '-');
  const fileName = getCaseAwareFileName({
    fileName: options.simpleModuleName ? name : projectName,
    pascalCaseFiles: options.pascalCaseFiles,
  });
  const projectRoot = joinPathFragments(libsDir, fullProjectDirectory);

  const parsedTags = options.tags
    ? options.tags.split(',').map((s) => s.trim())
    : [];

  const importPath =
    options.importPath || getImportPath(tree, fullProjectDirectory);

  return {
    ...options,
    fileName,
    name: projectName,
    projectRoot,
    projectDirectory: fullProjectDirectory,
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

function createFiles(tree: Tree, options: NormalizedSchema) {
  const { className, name, propertyName } = names(options.fileName);

  generateFiles(tree, join(__dirname, './files/lib'), options.projectRoot, {
    ...options,
    className,
    name,
    propertyName,
    tmpl: '',
    offsetFromRoot: offsetFromRoot(options.projectRoot),
  });

  if (options.unitTestRunner === 'none') {
    tree.delete(
      join(options.projectRoot, `./src/lib/${options.fileName}.spec.ts`)
    );
  }
  if (!options.publishable && !options.buildable) {
    tree.delete(join(options.projectRoot, 'package.json'));
  }
  if (options.js) {
    toJS(tree);
  }
}

function updateProject(tree: Tree, options: NormalizedSchema) {
  if (!options.publishable && !options.buildable) {
    return;
  }

  const project = readProjectConfiguration(tree, options.name);
  const { libsDir } = getWorkspaceLayout(tree);

  const rootProject = options.projectRoot === '.' || options.projectRoot === '';

  project.targets = project.targets || {};
  project.targets.build = {
    executor: `@nx/js:${options.compiler}`,
    outputs: ['{options.outputPath}'],
    options: {
      outputPath: joinPathFragments(
        'dist',
        rootProject
          ? options.projectDirectory
          : `${libsDir}/${options.projectDirectory}`
      ),
      tsConfig: `${options.projectRoot}/tsconfig.lib.json`,
      packageJson: `${options.projectRoot}/package.json`,
      main: `${options.projectRoot}/src/index` + (options.js ? '.js' : '.ts'),
      assets: [`${options.projectRoot}/*.md`],
    },
  };

  if (options.compiler === 'swc') {
    addSwcDependencies(tree);
    addSwcConfig(tree, options.projectRoot);
  }

  if (options.rootDir) {
    project.targets.build.options.srcRootForCompilationRoot = options.rootDir;
  }

  updateProjectConfiguration(tree, options.name, project);
}
