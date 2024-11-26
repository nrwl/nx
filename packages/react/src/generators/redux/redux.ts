import * as path from 'path';
import {
  addImport,
  addReduxStoreToMain,
  updateReduxStore,
} from '../../utils/ast-utils';
import { reactReduxVersion, reduxjsToolkitVersion } from '../../utils/versions';
import { NormalizedSchema, Schema } from './schema';
import {
  addDependenciesToPackageJson,
  applyChangesToString,
  formatFiles,
  generateFiles,
  getProjects,
  joinPathFragments,
  names,
  readJson,
  toJS,
  Tree,
} from '@nx/devkit';
import { getRootTsConfigPathInTree } from '@nx/js';
import { ensureTypescript } from '@nx/js/src/utils/typescript/ensure-typescript';
import { determineArtifactNameAndDirectoryOptions } from '@nx/devkit/src/generators/artifact-name-and-directory-utils';

let tsModule: typeof import('typescript');

export async function reduxGenerator(host: Tree, schema: Schema) {
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
    joinPathFragments(__dirname, './files'),
    options.projectDirectory,
    {
      ...options,
      tmpl: '',
    }
  );

  if (options.js) {
    toJS(host);
  }
}

function addReduxPackageDependencies(host: Tree) {
  return addDependenciesToPackageJson(
    host,
    {
      '@reduxjs/toolkit': reduxjsToolkitVersion,
      'react-redux': reactReduxVersion,
    },
    {}
  );
}

function addExportsToBarrel(host: Tree, options: NormalizedSchema) {
  if (!tsModule) {
    tsModule = ensureTypescript();
  }

  const indexFilePath = path.join(
    options.projectSourcePath,
    options.js ? 'index.js' : 'index.ts'
  );

  const indexSource = host.read(indexFilePath, 'utf-8');
  if (indexSource !== null) {
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
}

function addStoreConfiguration(host: Tree, options: NormalizedSchema) {
  if (!options.appProjectSourcePath) {
    return;
  }

  const mainSource = host.read(options.appMainFilePath, 'utf-8');
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

  if (!options.appProjectSourcePath) {
    return;
  }

  const mainSource = host.read(options.appMainFilePath, 'utf-8');
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

async function normalizeOptions(
  host: Tree,
  options: Schema
): Promise<NormalizedSchema> {
  const {
    artifactName: name,
    directory,
    fileName,
    project: projectName,
  } = await determineArtifactNameAndDirectoryOptions(host, {
    path: options.path,
    name: options.name,
    fileExtension: 'tsx',
  });

  let appProjectSourcePath: string;
  let appMainFilePath: string;
  const extraNames = names(name);

  const projects = getProjects(host);
  const project = projects.get(projectName);
  const { sourceRoot, projectType } = project;

  const tsConfigJson = readJson(host, getRootTsConfigPathInTree(host));
  const tsPaths: { [module: string]: string[] } = tsConfigJson.compilerOptions
    ? tsConfigJson.compilerOptions.paths || {}
    : {};
  const modulePath =
    projectType === 'application'
      ? options.path
        ? `./app/${options.path}/${extraNames.fileName}.slice`
        : `./app/${extraNames.fileName}.slice`
      : Object.keys(tsPaths).find((k) =>
          tsPaths[k].some((s) => s.includes(sourceRoot))
        );

  // If --project is set to an app, automatically configure store
  // for it without needing to specify --appProject.
  options.appProject =
    options.appProject ||
    (projectType === 'application' ? projectName : undefined);
  if (options.appProject) {
    const appConfig = projects.get(options.appProject);
    if (appConfig.projectType !== 'application') {
      throw new Error(
        `Expected ${options.appProject} to be an application but got ${appConfig.projectType}`
      );
    }
    appProjectSourcePath = appConfig.sourceRoot;
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
