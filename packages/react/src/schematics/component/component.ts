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
  template,
  Tree,
  url
} from '@angular-devkit/schematics';
import { Schema } from './schema';
import { names } from '@nrwl/workspace';
import {
  addDepsToPackageJson,
  addGlobal,
  getProjectConfig,
  insert
} from '@nrwl/workspace/src/utils/ast-utils';
import { CSS_IN_JS_DEPENDENCIES } from '../../utils/styled';
import { formatFiles } from '@nrwl/workspace';

interface NormalizedSchema extends Schema {
  projectSourceRoot: Path;
  fileName: string;
  className: string;
  styledModule: null | string;
}

export default function(schema: Schema): Rule {
  return (host: Tree) => {
    const options = normalizeOptions(host, schema);
    return chain([
      createComponentFiles(options),
      addStyledModuleDependencies(options),
      addExportsToBarrel(options),
      formatFiles({ skipFormat: false })
    ]);
  };
}

function createComponentFiles(options: NormalizedSchema): Rule {
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
      move(join(options.projectSourceRoot, 'lib'))
    ])
  );
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
  return options.export
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
              `export { default as ${options.className}, ${
                options.className
              }Props } from './lib/${options.name}/${options.fileName}';`
            )
          );
        }

        return host;
      }
    : noop();
}

function normalizeOptions(host: Tree, options: Schema): NormalizedSchema {
  const { className, fileName } = names(options.name);

  const componentFileName = options.pascalCaseFiles ? className : fileName;

  const { sourceRoot: projectSourceRoot } = getProjectConfig(
    host,
    options.project
  );

  const styledModule = /^(css|scss|less|styl)$/.test(options.style)
    ? null
    : options.style;

  return {
    ...options,
    styledModule,
    className,
    name: fileName,
    fileName: componentFileName,
    projectSourceRoot
  };
}
