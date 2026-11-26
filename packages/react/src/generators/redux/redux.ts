import { determineArtifactNameAndDirectoryOptions } from '@nx/devkit/internal';
import { assertSupportedReactVersion } from '../../utils/assert-supported-react-version';
import {
  addDependenciesToPackageJson,
  applyChangesToString,
  formatFiles,
  generateFiles,
  readProjectConfiguration,
  joinPathFragments,
  names,
  readJson,
  Tree,
} from '@nx/devkit';
import { getRootTsConfigPathInTree } from '@nx/js';
import {
  ensureTypescript,
  getProjectSourceRoot,
  getProjectType,
} from '@nx/js/internal';
import * as path from 'path';
import {
  addImport,
  addReduxStoreToMain,
  updateReduxStore,
} from '../../utils/ast-utils';
import { reactReduxVersion, reduxjsToolkitVersion } from '../../utils/versions';
import { NormalizedSchema, Schema } from './schema';

let tsModule: typeof import('typescript');

export async function reduxGenerator(host: Tree, schema: Schema) {
  assertSupportedReactVersion(host);

  const options = await normalizeOptions(host, schema);
  generateReduxFiles(host, options);
  addExportsToBarrel(host, options);
  const installTask = addReduxPackageDependencies(host);
  addStoreConfiguration(host, options);
  updateReducerConfiguration(host, options);

  await formatFiles(host);

  return installTask;
}

function generateReduxFiles(host: Tree, options: NormalizedSchema) {
  generateFiles(
    host,
    joinPathFragments(__dirname, 'files', options.fileExtensionType),
    options.projectDirectory,
    {
      ...options,
      ext: options.fileExtension,
    }
  );
}

function addReduxPackageDependencies(host: Tree) {
  return addDependenciesToPackageJson(
    host,
    {
      '@reduxjs/toolkit': reduxjsToolkitVersion,
      'react-redux': reactReduxVersion,
    },
    {},
    undefined,
    true
  );
}

function addExportsToBarrel(host: Tree, options: NormalizedSchema) {
  if (!tsModule) {
    tsModule = ensureTypescript();
  }

  if (!options.projectSourcePath) {
    throw new Error(
      `Cannot determine the source root of ${options.projectDirectory}.`
    );
  }
  const indexFilePath = joinPathFragments(
    options.projectSourcePath,
    options.fileExtensionType === 'js' ? 'index.js' : 'index.ts'
  );

  const indexSource = host.read(indexFilePath, 'utf-8');
  if (indexSource === null) {
    return;
  }
  const indexSourceFile = tsModule.createSourceFile(
    indexFilePath,
    indexSource,
    tsModule.ScriptTarget.Latest,
    true
  );

  const statePath = options.path
    ? `./lib/${options.path}/${options.fileName}`
    : `./lib/${options.fileName}`;
  const changes = applyChangesToString(
    indexSource,
    addImport(indexSourceFile, `export * from '${statePath}.slice';`)
  );
  host.write(indexFilePath, changes);
}

function addStoreConfiguration(host: Tree, options: NormalizedSchema) {
  if (!options.appProjectSourcePath || !options.appMainFilePath) {
    return;
  }

  const mainSource = readAppMain(host, options.appMainFilePath);
  if (!mainSource.includes('redux')) {
    const mainSourceFile = tsModule.createSourceFile(
      options.appMainFilePath,
      mainSource,
      tsModule.ScriptTarget.Latest,
      true
    );
    const changes = applyChangesToString(
      mainSource,
      addReduxStoreToMain(options.appMainFilePath, mainSourceFile)
    );
    host.write(options.appMainFilePath, changes);
  }
}

function updateReducerConfiguration(host: Tree, options: NormalizedSchema) {
  if (!tsModule) {
    tsModule = ensureTypescript();
  }

  if (!options.appProjectSourcePath || !options.appMainFilePath) {
    return;
  }

  const mainSource = readAppMain(host, options.appMainFilePath);
  const mainSourceFile = tsModule.createSourceFile(
    options.appMainFilePath,
    mainSource,
    tsModule.ScriptTarget.Latest,
    true
  );
  const changes = applyChangesToString(
    mainSource,
    updateReduxStore(options.appMainFilePath, mainSourceFile, {
      keyName: `${options.constantName}_FEATURE_KEY`,
      reducerName: `${options.propertyName}Reducer`,
      modulePath: `${options.projectModulePath}`,
    })
  );
  host.write(options.appMainFilePath, changes);
}

function readAppMain(host: Tree, appMainFilePath: string): string {
  const mainSource = host.read(appMainFilePath, 'utf-8');
  if (mainSource === null) {
    throw new Error(`Could not find ${appMainFilePath}.`);
  }
  return mainSource;
}

async function normalizeOptions(
  host: Tree,
  options: Schema
): Promise<NormalizedSchema> {
  const {
    artifactName: name,
    directory,
    fileName,
    fileExtension,
    fileExtensionType,
    project: projectName,
  } = await determineArtifactNameAndDirectoryOptions(host, {
    path: options.path,
    name: options.name,
    suffix: 'slice',
    allowedFileExtensions: ['js', 'ts'],
    fileExtension: options.js ? 'js' : 'ts',
    js: options.js,
  });

  let appProjectSourcePath: string | undefined;
  let appMainFilePath: string | undefined;
  const extraNames = names(name);

  const project = readProjectConfiguration(host, projectName);
  const { root, sourceRoot, projectType } = project;

  const rootTsConfigPath = getRootTsConfigPathInTree(host);
  if (!rootTsConfigPath) {
    throw new Error('Cannot find the root tsconfig file.');
  }
  const tsConfigJson = readJson(host, rootTsConfigPath);
  const tsPaths: { [module: string]: string[] } = tsConfigJson.compilerOptions
    ? tsConfigJson.compilerOptions.paths || {}
    : {};
  const modulePath =
    getProjectType(host, root, projectType) === 'application'
      ? options.path
        ? `./app/${options.path}/${extraNames.fileName}.slice`
        : `./app/${extraNames.fileName}.slice`
      : Object.keys(tsPaths).find((k) =>
          tsPaths[k].some(
            (s) => sourceRoot !== undefined && s.includes(sourceRoot)
          )
        );

  // If --project is set to an app, automatically configure store
  // for it without needing to specify --appProject.
  options.appProject =
    options.appProject ||
    (projectType === 'application' ? projectName : undefined);
  if (options.appProject) {
    const appConfig = readProjectConfiguration(host, options.appProject);
    if (appConfig.projectType !== 'application') {
      throw new Error(
        `Expected ${options.appProject} to be an application but got ${appConfig.projectType}`
      );
    }
    appProjectSourcePath = getProjectSourceRoot(appConfig, host);
    appMainFilePath = path.join(
      appProjectSourcePath,
      options.js ? 'main.js' : 'main.tsx'
    );
    if (!host.exists(appMainFilePath)) {
      throw new Error(
        `Could not find ${appMainFilePath} during store configuration`
      );
    }
  }

  return {
    ...options,
    ...extraNames,
    fileName,
    fileExtension,
    fileExtensionType,
    constantName: names(name).constantName.toUpperCase(),
    projectDirectory: directory,
    projectType,
    projectSourcePath: sourceRoot,
    projectModulePath: modulePath,
    appProjectSourcePath,
    appMainFilePath,
  };
}

export default reduxGenerator;
