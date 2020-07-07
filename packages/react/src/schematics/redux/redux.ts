import { join, Path, strings } from '@angular-devkit/core';
import {
  apply,
  chain,
  mergeWith,
  move,
  noop,
  Rule,
  SchematicContext,
  template,
  Tree,
  url,
} from '@angular-devkit/schematics';
import '@nrwl/tao/src/compat/compat';
import { formatFiles, getWorkspace, names, toFileName } from '@nrwl/workspace';
import {
  addDepsToPackageJson,
  addGlobal,
  getProjectConfig,
  insert,
  readJsonInTree,
} from '@nrwl/workspace/src/utils/ast-utils';
import { toJS } from '@nrwl/workspace/src/utils/rules/to-js';
import * as path from 'path';
import * as ts from 'typescript';
import { addReduxStoreToMain, updateReduxStore } from '../../utils/ast-utils';
import {
  reactReduxVersion,
  reduxjsToolkitVersion,
  typesReactReduxVersion,
} from '../../utils/versions';
import { NormalizedSchema, Schema } from './schema';

export default function (schema: any): Rule {
  return async (host: Tree, context: SchematicContext) => {
    const options = await normalizeOptions(host, schema);

    return chain([
      generateReduxFiles(options),
      addExportsToBarrel(options),
      addReduxPackageDependencies,
      addStoreConfiguration(options, context),
      updateReducerConfiguration(options, context),
      formatFiles(),
    ]);
  };
}

function generateReduxFiles(options: NormalizedSchema) {
  const templateSource = apply(url('./files'), [
    template({ ...options, tmpl: '' }),
    move(options.filesPath),
    options.js ? toJS() : noop(),
  ]);

  return mergeWith(templateSource);
}

function addReduxPackageDependencies(): Rule {
  return addDepsToPackageJson(
    {
      '@reduxjs/toolkit': reduxjsToolkitVersion,
      'react-redux': reactReduxVersion,
      '@types/react-redux': typesReactReduxVersion,
    },
    {}
  );
}

function addExportsToBarrel(options: NormalizedSchema): Rule {
  return (host: Tree) => {
    const indexFilePath = path.join(
      options.projectSourcePath,
      options.js ? 'index.js' : 'index.ts'
    );

    const buffer = host.read(indexFilePath);
    if (!!buffer) {
      const indexSource = buffer.toString('utf-8');
      const indexSourceFile = ts.createSourceFile(
        indexFilePath,
        indexSource,
        ts.ScriptTarget.Latest,
        true
      );

      const statePath = options.directory
        ? `./lib/${options.directory}/${options.fileName}`
        : `./lib/${options.fileName}`;

      insert(host, indexFilePath, [
        ...addGlobal(
          indexSourceFile,
          indexFilePath,
          `export * from '${statePath}.slice';`
        ),
      ]);
    }

    return host;
  };
}

function addStoreConfiguration(
  options: NormalizedSchema,
  context: SchematicContext
) {
  return options.appProjectSourcePath
    ? (host: Tree) => {
        const mainSource = host.read(options.appMainFilePath).toString();
        if (!mainSource.includes('redux')) {
          const mainSourceFile = ts.createSourceFile(
            options.appMainFilePath,
            mainSource,
            ts.ScriptTarget.Latest,
            true
          );
          insert(
            host,
            options.appMainFilePath,
            addReduxStoreToMain(
              options.appMainFilePath,
              mainSourceFile,
              context
            )
          );
        }
        return host;
      }
    : noop();
}

function updateReducerConfiguration(
  options: NormalizedSchema,
  context: SchematicContext
) {
  return options.appProjectSourcePath
    ? (host: Tree) => {
        const mainSource = host.read(options.appMainFilePath).toString();
        const mainSourceFile = ts.createSourceFile(
          options.appMainFilePath,
          mainSource,
          ts.ScriptTarget.Latest,
          true
        );
        insert(
          host,
          options.appMainFilePath,
          updateReduxStore(options.appMainFilePath, mainSourceFile, context, {
            keyName: `${options.constantName}_FEATURE_KEY`,
            reducerName: `${options.propertyName}Reducer`,
            modulePath: `${options.projectModulePath}`,
          })
        );
        return host;
      }
    : noop();
}

async function normalizeOptions(
  host: Tree,
  options: Schema
): Promise<NormalizedSchema> {
  let appProjectSourcePath: Path;
  let appMainFilePath: string;
  const extraNames = names(options.name);
  const { sourceRoot } = getProjectConfig(host, options.project);
  const workspace = await getWorkspace(host);
  const projectType = workspace.projects.get(options.project).extensions
    .projectType as string;
  const tsConfigJson = readJsonInTree(host, 'tsconfig.base.json');
  const tsPaths: { [module: string]: string[] } = tsConfigJson.compilerOptions
    ? tsConfigJson.compilerOptions.paths || {}
    : {};
  const modulePath =
    projectType === 'application'
      ? `./app/${extraNames.fileName}.slice`
      : Object.keys(tsPaths).find((k) =>
          tsPaths[k].some((s) => s.includes(sourceRoot))
        );
  // If --project is set to an app, automatically configure store
  // for it without needing to specify --appProject.
  options.appProject =
    options.appProject ||
    (projectType === 'application' ? options.project : undefined);
  if (options.appProject) {
    const appConfig = getProjectConfig(host, options.appProject);
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
    constantName: strings.underscore(options.name).toUpperCase(),
    directory: toFileName(options.directory),
    projectType,
    projectSourcePath: sourceRoot,
    projectModulePath: modulePath,
    appProjectSourcePath,
    appMainFilePath,
    filesPath: join(sourceRoot, projectType === 'application' ? 'app' : 'lib'),
  };
}
