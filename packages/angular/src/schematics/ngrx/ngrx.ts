import {
  apply,
  chain,
  url,
  mergeWith,
  template,
  move,
  noop,
  filter,
  Rule,
  Tree,
  SchematicContext
} from '@angular-devkit/schematics';

import { Schema } from './schema';
import * as path from 'path';

import { names, toFileName } from '@nrwl/schematics/src/utils/name-utils';

import {
  addImportsToModule,
  addNgRxToPackageJson,
  addExportsToBarrel,
  RequestContext
} from './rules';
import { formatFiles } from '@nrwl/schematics/src/utils/rules/format-files';
import { NodePackageInstallTask } from '@angular-devkit/schematics/tasks';

/**
 * Rule to generate the Nx 'ngrx' Collection
 * Note: see https://nrwl.io/nx/guide-setting-up-ngrx for guide to generated files
 */
export default function generateNgrxCollection(_options: Schema): Rule {
  return (host: Tree, context: SchematicContext) => {
    const options = normalizeOptions(_options);

    if (!options.module) {
      throw new Error(`The required --module option must be passed`);
    } else if (!host.exists(options.module)) {
      throw new Error(`Path does not exist: ${options.module}`);
    }

    const requestContext: RequestContext = {
      featureName: options.name,
      moduleDir: path.dirname(options.module),
      options,
      host
    };

    const fileGeneration = !options.onlyEmptyRoot
      ? [generateNgrxFilesFromTemplates(options)]
      : [];

    const moduleModification = !options.onlyAddFiles
      ? [
          addImportsToModule(requestContext),
          addExportsToBarrel(requestContext.options)
        ]
      : [];
    const packageJsonModification = !options.skipPackageJson
      ? [addNgRxToPackageJson()]
      : [];

    return chain([
      ...fileGeneration,
      ...moduleModification,
      ...packageJsonModification,
      formatFiles(options)
    ])(host, context);
  };
}

// ********************************************************
// Internal Function
// ********************************************************

/**
 * Generate 'feature' scaffolding: actions, reducer, effects, interfaces, selectors, facade
 */
function generateNgrxFilesFromTemplates(options: Schema) {
  const name = options.name;
  const moduleDir = path.dirname(options.module);
  const excludeFacade = path => path.match(/^((?!facade).)*$/);

  const templateSource = apply(url('./files'), [
    !options.facade ? filter(excludeFacade) : noop(),
    template({ ...options, tmpl: '', ...names(name) }),
    move(moduleDir)
  ]);

  return mergeWith(templateSource);
}

/**
 * Extract the parent 'directory' for the specified
 */
function normalizeOptions(options: Schema): Schema {
  return {
    ...options,
    directory: toFileName(options.directory)
  };
}
