import {
  apply,
  branchAndMerge,
  chain,
  mergeWith,
  Rule,
  SchematicContext,
  template,
  Tree,
  url
} from '@angular-devkit/schematics';
import { Schema } from './schema';
import { strings } from '@angular-devkit/core';
import {
  NodePackageInstallTask,
  RepositoryInitializerTask
} from '@angular-devkit/schematics/tasks';
import { libVersions } from '../../lib-versions';
import { DEFAULT_NRWL_PRETTIER_CONFIG } from '../../utils/common';

export default function(options: Schema): Rule {
  if (!options.name) {
    throw new Error(`Invalid options, "name" is required.`);
  }
  if (!options.directory) {
    options.directory = options.name;
  }

  return (host: Tree, context: SchematicContext) => {
    addTasks(options, context);
    const npmScope = options.npmScope ? options.npmScope : options.name;
    const templateSource = apply(url('./files'), [
      template({
        utils: strings,
        dot: '.',
        tmpl: '',
        ...libVersions,
        ...(options as object),
        npmScope,
        defaultNrwlPrettierConfig: JSON.stringify(
          DEFAULT_NRWL_PRETTIER_CONFIG,
          null,
          2
        )
      })
    ]);
    return chain([branchAndMerge(chain([mergeWith(templateSource)]))])(
      host,
      context
    );
  };
}

function addTasks(options: Schema, context: SchematicContext) {
  let packageTask;
  if (!options.skipInstall) {
    packageTask = context.addTask(
      new NodePackageInstallTask(options.directory)
    );
  }
  if (!options.skipGit) {
    const commit =
      typeof options.commit == 'object'
        ? options.commit
        : !!options.commit
        ? {}
        : false;
    context.addTask(
      new RepositoryInitializerTask(options.directory, commit),
      packageTask ? [packageTask] : []
    );
  }
}
