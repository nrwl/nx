import { normalize, Path } from '@angular-devkit/core';
import {
  apply,
  chain,
  externalSchematic,
  filter,
  MergeStrategy,
  mergeWith,
  move,
  noop,
  Rule,
  SchematicContext,
  template,
  Tree,
  url,
} from '@angular-devkit/schematics';
import {
  addGlobal,
  deleteFile,
  formatFiles,
  getNpmScope,
  getProjectConfig,
  insert,
  names,
  offsetFromRoot,
  toFileName,
  updateJsonInTree,
  updateWorkspaceInTree,
} from '@nrwl/workspace';
import { Schema } from './schema';
import * as ts from 'typescript';
import { libsDir, RemoveChange } from '@nrwl/workspace/src/utils/ast-utils';

export interface NormalizedSchema extends Schema {
  name: string;
  prefix: string;
  fileName: string;
  projectRoot: Path;
  projectDirectory: string;
  parsedTags: string[];
}

export default function (schema: NormalizedSchema): Rule {
  return (host: Tree, context: SchematicContext) => {
    const options = normalizeOptions(host, schema);

    return chain([
      externalSchematic('@nrwl/node', 'lib', schema),
      createFiles(options),
      addExportsToBarrelFile(options),
      updateTsConfig(options),
      addProject(options),
      formatFiles(options),
      deleteFile(`/${options.projectRoot}/src/lib/${options.fileName}.spec.ts`),
      deleteFile(`/${options.projectRoot}/src/lib/${options.fileName}.ts`),
    ]);
  };
}

function normalizeOptions(host: Tree, options: Schema): NormalizedSchema {
  const defaultPrefix = getNpmScope(host);
  const name = toFileName(options.name);
  const projectDirectory = options.directory
    ? `${toFileName(options.directory)}/${name}`
    : name;

  const projectName = projectDirectory.replace(new RegExp('/', 'g'), '-');
  const fileName = projectName;
  const projectRoot = normalize(`${libsDir(host)}/${projectDirectory}`);

  const parsedTags = options.tags
    ? options.tags.split(',').map((s) => s.trim())
    : [];

  const normalized: NormalizedSchema = {
    ...options,
    prefix: defaultPrefix, // we could also allow customizing this
    fileName,
    name: projectName,
    projectRoot,
    projectDirectory,
    parsedTags,
  };

  return normalized;
}

function addExportsToBarrelFile(options: NormalizedSchema): Rule {
  return (host: Tree) => {
    const indexFilePath = `${options.projectRoot}/src/index.ts`;
    const buffer = host.read(indexFilePath);
    if (!!buffer) {
      const indexSource = buffer!.toString('utf-8');
      const indexSourceFile = ts.createSourceFile(
        indexFilePath,
        indexSource,
        ts.ScriptTarget.Latest,
        true
      );

      insert(host, indexFilePath, [
        new RemoveChange(
          indexFilePath,
          0,
          `export * from './lib/${options.fileName}';`
        ),
        ...addGlobal(
          indexSourceFile,
          indexFilePath,
          `export * from './lib/${options.fileName}.module';`
        ),
        ...(options.service
          ? addGlobal(
              indexSourceFile,
              indexFilePath,
              `export * from './lib/${options.fileName}.service';`
            )
          : []),
        ...(options.controller
          ? addGlobal(
              indexSourceFile,
              indexFilePath,
              `export * from './lib/${options.fileName}.controller';`
            )
          : []),
      ]);
    }
  };
}

function createFiles(options: NormalizedSchema): Rule {
  return mergeWith(
    apply(url(`./files/lib`), [
      template({
        ...options,
        ...names(options.name),
        tmpl: '',
        offsetFromRoot: offsetFromRoot(options.projectRoot),
      }),
      move(options.projectRoot),
      options.unitTestRunner === 'none'
        ? filter((file) => !file.endsWith('spec.ts'))
        : noop(),
      options.publishable
        ? noop()
        : filter((file) => !file.endsWith('package.json')),
      options.service
        ? noop()
        : filter((file) => !file.endsWith('.service.ts')),
      options.controller
        ? noop()
        : filter((file) => !file.endsWith('.controller.ts')),
      !options.controller || options.unitTestRunner === 'none'
        ? filter((file) => !file.endsWith('.controller.spec.ts'))
        : noop(),
      !options.service || options.unitTestRunner === 'none'
        ? filter((file) => !file.endsWith('.service.spec.ts'))
        : noop(),
    ]),
    MergeStrategy.Overwrite
  );
}

function updateTsConfig(options: NormalizedSchema): Rule {
  return (host: Tree, context: SchematicContext) => {
    const projectConfig = getProjectConfig(host, options.name);
    return updateJsonInTree(
      `${projectConfig.root}/tsconfig.lib.json`,
      (json) => {
        json.compilerOptions.target = options.target;
        return json;
      }
    );
  };
}

function addProject(options: NormalizedSchema): Rule {
  if (!options.publishable && !options.buildable) {
    return noop();
  }

  return updateWorkspaceInTree(
    (json, context: SchematicContext, host: Tree) => {
      const architect = json.projects[options.name].architect;
      if (architect) {
        architect.build = {
          builder: '@nrwl/node:package',
          options: {
            outputPath: `dist/${libsDir(host)}/${options.projectDirectory}`,
            tsConfig: `${options.projectRoot}/tsconfig.lib.json`,
            packageJson: `${options.projectRoot}/package.json`,
            main: `${options.projectRoot}/src/index.ts`,
            assets: [`${options.projectRoot}/*.md`],
          },
        };
      }
      return json;
    }
  );
}
