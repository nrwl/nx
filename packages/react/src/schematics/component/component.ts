import { join, Path } from '@angular-devkit/core';
import * as ts from 'typescript';
import {
  apply,
  chain,
  filter,
  mergeWith,
  move,
  noop,
  Rule,
  SchematicContext,
  template,
  Tree,
  url
} from '@angular-devkit/schematics';
import { Schema } from './schema';
import { formatFiles, getWorkspace, names } from '@nrwl/workspace';
import {
  addDepsToPackageJson,
  addGlobal,
  getProjectConfig,
  insert
} from '@nrwl/workspace/src/utils/ast-utils';
import { CSS_IN_JS_DEPENDENCIES } from '../../utils/styled';
import {
  reactRouterTypesVersion,
  reactRouterDomVersion
} from '../../utils/versions';
import { assertValidStyle } from '../../utils/assertion';

interface NormalizedSchema extends Schema {
  projectSourceRoot: Path;
  fileName: string;
  className: string;
  styledModule: null | string;
}

export default function(schema: Schema): Rule {
  return (host: Tree, context: SchematicContext) => {
    const options = normalizeOptions(host, schema, context);
    return chain([
      createComponentFiles(options),
      addStyledModuleDependencies(options),
      addExportsToBarrel(options),
      options.routing
        ? addDepsToPackageJson(
            { 'react-router-dom': reactRouterDomVersion },
            { '@types/react-router-dom': reactRouterTypesVersion }
          )
        : noop(),
      formatFiles({ skipFormat: false })
    ]);
  };
}

function createComponentFiles(options: NormalizedSchema): Rule {
  return async (host: Tree, context: SchematicContext) => {
    const workspace = await getWorkspace(host);
    const directory = join(
      options.projectSourceRoot,
      workspace.projects.get(options.project).extensions.projectType ===
        'application'
        ? 'app'
        : 'lib'
    );
    return mergeWith(
      apply(url(`./files`), [
        template({
          ...options,
          tmpl: ''
        }),
        options.skipTests ? filter(file => !/.*spec.tsx/.test(file)) : noop(),
        options.styledModule
          ? filter(file => !file.endsWith(`.${options.style}`))
          : noop(),
        move(directory)
      ])
    );
  };
}

function addStyledModuleDependencies(options: NormalizedSchema): Rule {
  const extraDependencies = CSS_IN_JS_DEPENDENCIES[options.styledModule];

  return extraDependencies
    ? addDepsToPackageJson(
        extraDependencies.dependencies,
        extraDependencies.devDependencies
      )
    : noop();
}

function addExportsToBarrel(options: NormalizedSchema): Rule {
  return async (host: Tree) => {
    const workspace = await getWorkspace(host);
    const isApp =
      workspace.projects.get(options.project).extensions.type === 'application';
    return options.export && !isApp
      ? (host: Tree) => {
          const indexFilePath = join(options.projectSourceRoot, 'index.ts');
          const buffer = host.read(indexFilePath);
          if (!!buffer) {
            const indexSource = buffer!.toString('utf-8');
            const indexSourceFile = ts.createSourceFile(
              indexFilePath,
              indexSource,
              ts.ScriptTarget.Latest,
              true
            );

            insert(
              host,
              indexFilePath,
              addGlobal(
                indexSourceFile,
                indexFilePath,
                options.directory
                  ? `export * from './lib/${options.directory}/${options.fileName}';`
                  : `export * from './lib/${options.fileName}';`
              )
            );
          }

          return host;
        }
      : noop();
  };
}

function normalizeOptions(
  host: Tree,
  options: Schema,
  context: SchematicContext
): NormalizedSchema {
  const { className, fileName } = names(options.name);
  const componentFileName = options.pascalCaseFiles ? className : fileName;
  const { sourceRoot: projectSourceRoot, projectType } = getProjectConfig(
    host,
    options.project
  );

  const styledModule = /^(css|scss|less|styl)$/.test(options.style)
    ? null
    : options.style;

  assertValidStyle(options.style);

  if (options.export && projectType === 'application') {
    context.logger.warn(
      `The "--export" option should not be used with applications and will do nothing.`
    );
  }

  const slashes = ['/', '\\'];
  slashes.forEach(s => {
    if (componentFileName.indexOf(s) !== -1) {
      const [name, ...rest] = componentFileName.split(s).reverse();
      let suggestion = rest.map(x => x.toLowerCase()).join(s);
      if (options.directory) {
        suggestion = `${options.directory}${s}${suggestion}`;
      }
      throw new Error(
        `Found "${s}" in the component name. Did you mean to use the --directory option (e.g. \`nx g c ${name} --directory ${suggestion}\`)?`
      );
    }
  });

  return {
    ...options,
    directory: options.directory || '',
    styledModule,
    className,
    fileName: componentFileName,
    projectSourceRoot
  };
}
