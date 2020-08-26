import {
  chain,
  externalSchematic,
  Rule,
  Tree,
  SchematicContext,
  mergeWith,
  apply,
  url,
  template,
  move,
  noop,
  SchematicsException,
} from '@angular-devkit/schematics';
import { join, normalize } from '@angular-devkit/core';
import { Schema } from './schema';

import { updateWorkspaceInTree, getNpmScope } from '@nrwl/workspace';
import { updateJsonInTree } from '@nrwl/workspace';
import { toFileName, names } from '@nrwl/workspace';
import { formatFiles } from '@nrwl/workspace';
import { offsetFromRoot } from '@nrwl/workspace';

import { generateProjectLint, addLintFiles } from '../../utils/lint';
import { addProjectToNxJsonInTree, libsDir } from '../../utils/ast-utils';
import { cliCommand } from '../../core/file-utils';
import { toJS } from '../../utils/rules/to-js';

export interface NormalizedSchema extends Schema {
  name: string;
  fileName: string;
  projectRoot: string;
  projectDirectory: string;
  parsedTags: string[];
  importPath?: string;
}

function addProject(options: NormalizedSchema): Rule {
  return updateWorkspaceInTree((json) => {
    const architect: { [key: string]: any } = {};

    architect.lint = generateProjectLint(
      normalize(options.projectRoot),
      join(normalize(options.projectRoot), 'tsconfig.lib.json'),
      options.linter
    );

    json.projects[options.name] = {
      root: options.projectRoot,
      sourceRoot: join(normalize(options.projectRoot), 'src'),
      projectType: 'library',
      schematics: {},
      architect,
    };
    return json;
  });
}

function updateTsConfig(options: NormalizedSchema): Rule {
  return (host: Tree) =>
    updateJsonInTree('tsconfig.base.json', (json) => {
      const c = json.compilerOptions;
      c.paths = c.paths || {};
      delete c.paths[options.name];

      if (c.paths[options.importPath]) {
        throw new SchematicsException(
          `You already have a library using the import path "${options.importPath}". Make sure to specify a unique one.`
        );
      }

      c.paths[options.importPath] = [
        maybeJs(
          options,
          `${libsDir(host)}/${options.projectDirectory}/src/index.ts`
        ),
      ];

      return json;
    });
}

function createFiles(options: NormalizedSchema): Rule {
  return mergeWith(
    apply(url(`./files/lib`), [
      template({
        ...options,
        ...names(options.name),
        cliCommand: cliCommand(),
        tmpl: '',
        offsetFromRoot: offsetFromRoot(options.projectRoot),
        hasUnitTestRunner: options.unitTestRunner !== 'none',
      }),
      move(options.projectRoot),
      options.js ? toJS() : noop(),
    ])
  );
}

function updateNxJson(options: NormalizedSchema): Rule {
  return addProjectToNxJsonInTree(options.name, { tags: options.parsedTags });
}

export default function (schema: Schema): Rule {
  return (host: Tree, context: SchematicContext) => {
    const options = normalizeOptions(host, schema);

    return chain([
      addLintFiles(options.projectRoot, options.linter),
      createFiles(options),
      !options.skipTsConfig ? updateTsConfig(options) : noop(),
      addProject(options),
      updateNxJson(options),
      options.unitTestRunner !== 'none'
        ? externalSchematic('@nrwl/jest', 'jest-project', {
            project: options.name,
            setupFile: 'none',
            supportTsx: true,
            skipSerializers: true,
            testEnvironment: options.testEnvironment,
          })
        : noop(),
      formatFiles(options),
    ])(host, context);
  };
}

function normalizeOptions(host: Tree, options: Schema): NormalizedSchema {
  const name = toFileName(options.name);
  const projectDirectory = options.directory
    ? `${toFileName(options.directory)}/${name}`
    : name;

  const projectName = projectDirectory.replace(new RegExp('/', 'g'), '-');
  const fileName = options.simpleModuleName ? name : projectName;

  // const projectRoot = `libs/${projectDirectory}`;
  const projectRoot = `${libsDir(host)}/${projectDirectory}`;

  const parsedTags = options.tags
    ? options.tags.split(',').map((s) => s.trim())
    : [];

  const defaultImportPath = `@${getNpmScope(host)}/${projectDirectory}`;
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

function maybeJs(options: NormalizedSchema, path: string): string {
  return options.js && (path.endsWith('.ts') || path.endsWith('.tsx'))
    ? path.replace(/\.tsx?$/, '.js')
    : path;
}
