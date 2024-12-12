import {
  addDependenciesToPackageJson,
  formatFiles,
  generateFiles,
  GeneratorCallback,
  installPackagesTask,
  joinPathFragments,
  names,
  offsetFromRoot,
  readNxJson,
  readProjectConfiguration,
  runTasksInSerial,
  toJS,
  Tree,
  updateProjectConfiguration,
  updateTsConfigsToJs,
  writeJson,
} from '@nx/devkit';
import {
  determineProjectNameAndRootOptions,
  ensureProjectName,
} from '@nx/devkit/src/generators/project-name-and-root-utils';
import { libraryGenerator as jsLibraryGenerator } from '@nx/js';
import { addSwcConfig } from '@nx/js/src/utils/swc/add-swc-config';
import { addSwcDependencies } from '@nx/js/src/utils/swc/add-swc-dependencies';
import { join } from 'path';
import { tslibVersion, typesNodeVersion } from '../../utils/versions';
import { initGenerator } from '../init/init';
import { Schema } from './schema';
import { addBuildTargetDefaults } from '@nx/devkit/src/generators/target-defaults-utils';
import { isUsingTsSolutionSetup } from '@nx/js/src/utils/typescript/ts-solution-setup';
import { getImportPath } from '@nx/js/src/utils/get-import-path';

export interface NormalizedSchema extends Schema {
  fileName: string;
  projectName: string;
  projectRoot: string;
  parsedTags: string[];
  compiler: 'swc' | 'tsc';
  isUsingTsSolutionConfig: boolean;
}

export async function libraryGenerator(tree: Tree, schema: Schema) {
  return await libraryGeneratorInternal(tree, {
    addPlugin: false,
    ...schema,
  });
}

export async function libraryGeneratorInternal(tree: Tree, schema: Schema) {
  const options = await normalizeOptions(tree, schema);
  const tasks: GeneratorCallback[] = [];

  if (options.publishable === true && !schema.importPath) {
    throw new Error(
      `For publishable libs you have to provide a proper "--importPath" which needs to be a valid npm package name (e.g. my-awesome-lib or @myorg/my-lib)`
    );
  }

  // Create `package.json` first because @nx/js:lib generator will update it.
  if (
    options.isUsingTsSolutionConfig ||
    options.publishable ||
    options.buildable
  ) {
    writeJson(tree, joinPathFragments(options.projectRoot, 'package.json'), {
      name: getImportPath(tree, options.name),
      version: '0.0.1',
      private: true,
      files: options.publishable ? ['dist', '!**/*.tsbuildinfo'] : undefined,
    });
  }

  tasks.push(
    await jsLibraryGenerator(tree, {
      ...schema,
      bundler: schema.buildable || schema.publishable ? 'tsc' : 'none',
      includeBabelRc: schema.babelJest,
      importPath: schema.importPath,
      testEnvironment: 'node',
      skipFormat: true,
      setParserOptionsProject: schema.setParserOptionsProject,
      useProjectJson: !options.isUsingTsSolutionConfig,
    })
  );

  tasks.push(
    await initGenerator(tree, {
      ...options,
      skipFormat: true,
    })
  );

  createFiles(tree, options);

  if (options.js) {
    updateTsConfigsToJs(tree, options);
  }
  updateProject(tree, options);

  tasks.push(ensureDependencies(tree));

  // Always run install to link packages.
  if (options.isUsingTsSolutionConfig) {
    tasks.push(() => installPackagesTask(tree, true));
  }

  if (!schema.skipFormat) {
    await formatFiles(tree);
  }

  return runTasksInSerial(...tasks);
}

export default libraryGenerator;

async function normalizeOptions(
  tree: Tree,
  options: Schema
): Promise<NormalizedSchema> {
  await ensureProjectName(tree, options, 'library');
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
  });

  const nxJson = readNxJson(tree);
  const addPluginDefault =
    process.env.NX_ADD_PLUGINS !== 'false' &&
    nxJson.useInferencePlugins !== false;

  options.addPlugin ??= addPluginDefault;

  const fileName = names(
    options.simpleModuleName
      ? projectNames.projectSimpleName
      : projectNames.projectFileName
  ).fileName;

  const parsedTags = options.tags
    ? options.tags.split(',').map((s) => s.trim())
    : [];

  return {
    ...options,
    fileName,
    projectName,
    projectRoot,
    parsedTags,
    importPath,
    isUsingTsSolutionConfig: isUsingTsSolutionSetup(tree),
  };
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
  if (options.js) {
    toJS(tree);
  }
}

function updateProject(tree: Tree, options: NormalizedSchema) {
  if (!options.publishable && !options.buildable) {
    return;
  }

  const project = readProjectConfiguration(tree, options.projectName);
  const rootProject = options.projectRoot === '.' || options.projectRoot === '';

  project.targets = project.targets || {};
  addBuildTargetDefaults(tree, `@nx/js:${options.compiler}`);

  // For TS solution, we want tsc build to be inferred by `@nx/js/typescript` plugin.
  if (!options.isUsingTsSolutionConfig || options.compiler === 'swc') {
    project.targets.build = {
      executor: `@nx/js:${options.compiler}`,
      outputs: ['{options.outputPath}'],
      options: {
        outputPath: options.isUsingTsSolutionConfig
          ? joinPathFragments(options.projectRoot, 'dist')
          : joinPathFragments(
              'dist',
              rootProject ? options.projectName : options.projectRoot
            ),
        tsConfig: `${options.projectRoot}/tsconfig.lib.json`,
        packageJson: `${options.projectRoot}/package.json`,
        main: `${options.projectRoot}/src/index` + (options.js ? '.js' : '.ts'),
        assets: options.isUsingTsSolutionConfig
          ? undefined
          : [`${options.projectRoot}/*.md`],
        stripLeadingPaths: options.isUsingTsSolutionConfig ? true : undefined,
      },
    };
  }

  if (options.compiler === 'swc') {
    addSwcDependencies(tree);
    addSwcConfig(tree, options.projectRoot);
  }

  if (options.rootDir) {
    project.targets.build.options.srcRootForCompilationRoot = options.rootDir;
  }

  updateProjectConfiguration(tree, options.projectName, project);
}

function ensureDependencies(tree: Tree): GeneratorCallback {
  return addDependenciesToPackageJson(
    tree,
    { tslib: tslibVersion },
    { '@types/node': typesNodeVersion }
  );
}
