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
  url
} from '@angular-devkit/schematics';
import {
  deleteFile,
  formatFiles,
  getNpmScope,
  getProjectConfig,
  names,
  offsetFromRoot,
  toFileName,
  updateJsonInTree,
  updateWorkspaceInTree
} from '@nrwl/workspace';
import { Schema } from './schema';
import { addExportsToBarrelFile } from '../../utils/files';

export interface NormalizedSchema extends Schema {
  name: string;
  prefix: string;
  fileName: string;
  projectRoot: Path;
  projectDirectory: string;
  parsedTags: string[];
}

export default function(schema: NormalizedSchema): Rule {
  return (host: Tree, context: SchematicContext) => {
    const options = normalizeOptions(host, schema);

    return chain([
      externalSchematic('@nrwl/node', 'lib', schema),
      createFiles(options),
      options.controller || options.service || options.global
        ? addExportsToBarrelFile(options, [
            `export * from './lib/${options.fileName}.module';`
          ])
        : noop(),
      ...runExternalSchematics(options),
      updateTsConfig(options),
      addProject(options),
      formatFiles(options),
      deleteFile(`/${options.projectRoot}/src/lib/${options.fileName}.ts`),
      deleteFile(`/${options.projectRoot}/src/lib/${options.fileName}.spec.ts`)
    ]);
  };
}

function runExternalSchematics(options: NormalizedSchema): Rule[] {
  return [
    options.guard
      ? externalSchematic('@nrwl/nest', 'guard', {
          ...options,
          project: options.name
        })
      : noop(),
    options.middleware
      ? externalSchematic('@nrwl/nest', 'middleware', {
          ...options,
          project: options.name
        })
      : noop(),
    options.controller
      ? externalSchematic('@nrwl/nest', 'controller', {
          ...options,
          project: options.name
        })
      : noop(),
    options.service && !options.controller
      ? externalSchematic('@nrwl/nest', 'service', {
          ...options,
          project: options.name
        })
      : noop(),
    options.interceptor
      ? externalSchematic('@nrwl/nest', 'interceptor', {
          ...options,
          project: options.name
        })
      : noop(),
    options.pipe
      ? externalSchematic('@nrwl/nest', 'pipe', {
          ...options,
          project: options.name
        })
      : noop()
  ];
}

function normalizeOptions(host: Tree, options: Schema): NormalizedSchema {
  const defaultPrefix = getNpmScope(host);
  const name = toFileName(options.name);
  const projectDirectory = options.directory
    ? `${toFileName(options.directory)}/${name}`
    : name;

  const projectName = projectDirectory.replace(new RegExp('/', 'g'), '-');
  const fileName = projectName;
  const projectRoot = normalize(`libs/${projectDirectory}`);

  const parsedTags = options.tags
    ? options.tags.split(',').map(s => s.trim())
    : [];

  const normalized: NormalizedSchema = {
    ...options,
    prefix: defaultPrefix, // we could also allow customizing this
    fileName,
    name: projectName,
    projectRoot,
    projectDirectory,
    parsedTags
  };

  return normalized;
}

function createFiles(options: NormalizedSchema): Rule {
  return mergeWith(
    apply(url(`./files/lib`), [
      template({
        ...options,
        ...names(options.name),
        tmpl: '',
        offsetFromRoot: offsetFromRoot(options.projectRoot)
      }),
      move(options.projectRoot),
      options.unitTestRunner === 'none'
        ? filter(file => !file.endsWith('spec.ts'))
        : noop(),
      options.publishable
        ? noop()
        : filter(file => !file.endsWith('package.json')),
      options.service ? noop() : filter(file => !file.endsWith('.service.ts')),
      options.controller
        ? noop()
        : filter(file => !file.endsWith('.controller.ts')),
      !options.controller || options.unitTestRunner === 'none'
        ? filter(file => !file.endsWith('.controller.spec.ts'))
        : noop(),
      !options.service || options.unitTestRunner === 'none'
        ? filter(file => !file.endsWith('.service.spec.ts'))
        : noop(),
      !options.controller && !options.service && !options.global
        ? filter(file => !file.endsWith('.module.ts'))
        : noop()
    ]),
    MergeStrategy.Overwrite
  );
}

function updateTsConfig(options: NormalizedSchema): Rule {
  return (host: Tree, context: SchematicContext) => {
    const projectConfig = getProjectConfig(host, options.name);
    return updateJsonInTree(`${projectConfig.root}/tsconfig.json`, json => {
      json.compilerOptions.target = options.target;
      return json;
    });
  };
}

function addProject(options: NormalizedSchema): Rule {
  if (!options.publishable) {
    return noop();
  }

  return updateWorkspaceInTree(json => {
    const architect = json.projects[options.name].architect;
    if (architect) {
      architect.build = {
        builder: '@nrwl/node:package',
        options: {
          outputPath: `dist/libs/${options.projectDirectory}`,
          tsConfig: `${options.projectRoot}/tsconfig.lib.json`,
          packageJson: `${options.projectRoot}/package.json`,
          main: `${options.projectRoot}/src/index.ts`,
          assets: [`${options.projectRoot}/*.md`]
        }
      };
    }
    return json;
  });
}
