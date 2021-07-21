import * as path from 'path';
import * as ts from 'typescript';
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
  convertNxGenerator,
  formatFiles,
  generateFiles,
  getProjects,
  joinPathFragments,
  names,
  readJson,
  toJS,
  Tree,
} from '@nrwl/devkit';

export async function reduxGenerator(host: Tree, schema: Schema) {
  const options = normalizeOptions(host, schema);
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
    options.filesPath,
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
  const indexFilePath = path.join(
    options.projectSourcePath,
    options.js ? 'index.js' : 'index.ts'
  );

  const indexSource = host.read(indexFilePath, 'utf-8');
  if (indexSource !== null) {
    const indexSourceFile = ts.createSourceFile(
      indexFilePath,
      indexSource,
      ts.ScriptTarget.Latest,
      true
    );

    const statePath = options.directory
      ? `./lib/${options.directory}/${options.fileName}`
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
    const mainSourceFile = ts.createSourceFile(
      options.appMainFilePath,
      mainSource,
      ts.ScriptTarget.Latest,
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
  if (!options.appProjectSourcePath) {
    return;
  }

  const mainSource = host.read(options.appMainFilePath, 'utf-8');
  const mainSourceFile = ts.createSourceFile(
    options.appMainFilePath,
    mainSource,
    ts.ScriptTarget.Latest,
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

function normalizeOptions(host: Tree, options: Schema): NormalizedSchema {
  let appProjectSourcePath: string;
  let appMainFilePath: string;
  const extraNames = names(options.name);
  const projects = getProjects(host);
  const project = projects.get(options.project);
  const { sourceRoot, projectType } = project;

  const tsConfigJson = readJson(host, 'tsconfig.base.json');
  const tsPaths: { [module: string]: string[] } = tsConfigJson.compilerOptions
    ? tsConfigJson.compilerOptions.paths || {}
    : {};
  const modulePath =
    projectType === 'application'
      ? options.directory
        ? `./app/${options.directory}/${extraNames.fileName}.slice`
        : `./app/${extraNames.fileName}.slice`
      : Object.keys(tsPaths).find((k) =>
          tsPaths[k].some((s) => s.includes(sourceRoot))
        );

  // If --project is set to an app, automatically configure store
  // for it without needing to specify --appProject.
  options.appProject =
    options.appProject ||
    (projectType === 'application' ? options.project : undefined);
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
    constantName: names(options.name).constantName.toUpperCase(),
    directory: names(options.directory ?? '').fileName,
    projectType,
    projectSourcePath: sourceRoot,
    projectModulePath: modulePath,
    appProjectSourcePath,
    appMainFilePath,
    filesPath: joinPathFragments(
      sourceRoot,
      projectType === 'application' ? 'app' : 'lib'
    ),
  };
}

export default reduxGenerator;
export const reduxSchematic = convertNxGenerator(reduxGenerator);
